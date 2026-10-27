import Hls, {type ErrorData} from 'hls.js';
import {log} from './bridge';
import {HLS_CONFIG, RECYCLE_MS, levelCap} from './quality';

/** Ways to play a stream, tried in order until one works. */
export type Mode = 'xhr' | 'fetch' | 'native';
const MODES: Mode[] = ['xhr', 'fetch', 'native'];

export class Player {
  private hls: Hls | null = null;
  private recycleTimer: ReturnType<typeof setTimeout> | undefined;

  /** @param onStatus shows a status line over the video ('' hides it) */
  constructor(
    private readonly container: HTMLElement,
    private readonly onStatus: (text: string) => void,
  ) {}

  private get video(): HTMLVideoElement {
    return this.container.querySelector('video') as HTMLVideoElement;
  }

  play(url: string, mode: Mode = 'xhr'): void {
    this.stop();
    const video = this.video;
    let retries = 0;
    this.onStatus('Cargando…');
    log(`start mode=${mode}`);

    video.onplaying = () => {
      this.onStatus('');
      log(`playing mode=${mode}`);
      this.scheduleRecycle(url, mode);
    };

    const fallback = (reason: string) => {
      log(`fail mode=${mode} ${reason}`);
      const next = MODES[MODES.indexOf(mode) + 1];
      if (next) {
        this.play(url, next);
      } else {
        this.onStatus(`No se pudo reproducir (${reason})`);
      }
    };

    if (mode === 'native') {
      if (!video.canPlayType('application/vnd.apple.mpegurl')) {
        return fallback('sin HLS nativo');
      }
      video.onerror = () =>
        fallback(
          `nativo: ${
            video.error ? `${video.error.code} ${video.error.message}` : '?'
          }`,
        );
      video.src = url;
      video.play().catch(() => {});
      return;
    }

    if (!Hls.isSupported()) {
      return fallback('sin MSE');
    }

    // 'fetch' makes hls.js use fetch() instead of XMLHttpRequest, which some
    // WebView builds block for pages loaded from file://
    const hls = new Hls({...HLS_CONFIG, progressive: mode === 'fetch'});
    this.hls = hls;
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const cap = levelCap(hls.levels);
      if (cap >= 0) {
        hls.autoLevelCapping = cap;
      }
      video.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (_e, d: ErrorData) => {
      const code = d.response?.code;
      const why = `${d.details}${code !== undefined ? ` http=${code}` : ''}${
        d.error ? ` ${d.error.message}` : ''
      }`;
      log(`hls error fatal=${d.fatal} ${why}`);
      if (!d.fatal) {
        return;
      }
      if (d.type === Hls.ErrorTypes.MEDIA_ERROR && retries++ < 2) {
        hls.recoverMediaError();
        return;
      }
      // A real HTTP status means the request went through: retry. Status 0
      // means it was blocked, so try the next mode instead.
      if (d.type === Hls.ErrorTypes.NETWORK_ERROR && code && retries++ < 2) {
        this.onStatus(`Reconectando… (${why})`);
        hls.startLoad();
        return;
      }
      fallback(why);
    });
    hls.loadSource(url);
    hls.attachMedia(video);
  }

  stop(): void {
    clearTimeout(this.recycleTimer);
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    // A brand-new <video> releases the old MediaSource buffers
    const old = this.video;
    old.onerror = null;
    old.onplaying = null;
    old.removeAttribute('src');
    old.load();
    const fresh = document.createElement('video');
    fresh.autoplay = true;
    fresh.setAttribute('playsinline', '');
    old.replaceWith(fresh);
  }

  private scheduleRecycle(url: string, mode: Mode): void {
    clearTimeout(this.recycleTimer);
    this.recycleTimer = setTimeout(() => {
      log('recycle');
      this.play(url, mode);
    }, RECYCLE_MS);
  }
}

import Hls, {type ErrorData} from 'hls.js';
import {fetchManifest, log} from './bridge';
import {playlistBlobUrl} from './manifest';
import {HLS_CONFIG, NATIVE_RECYCLE_MS, levelCap} from './quality';

/** Ways to play a stream, tried in order until one works. */
export type Mode = 'xhr' | 'fetch' | 'native';
const MODES: Mode[] = ['xhr', 'fetch', 'native'];

const STATS_MS = 30 * 1000;
const MB = 1024 * 1024;

/** One log line to tell a growing media buffer from a growing JS heap. */
function playbackStats(video: HTMLVideoElement): string {
  const b = video.buffered;
  let buffered = 0;
  for (let i = 0; i < b.length; i++) {
    buffered += b.end(i) - b.start(i);
  }
  const heap = (performance as {memory?: {usedJSHeapSize: number}}).memory;
  const q = video.getVideoPlaybackQuality?.();
  return [
    'stats',
    `t=${video.currentTime.toFixed(0)}`,
    `buffered=${buffered.toFixed(1)}s/${b.length}`,
    `heap=${heap ? (heap.usedJSHeapSize / MB).toFixed(1) : '?'}MB`,
    `frames=${q ? `${q.totalVideoFrames}/${q.droppedVideoFrames}` : '?'}`,
  ].join(' ');
}

export class Player {
  private hls: Hls | null = null;
  private recycleTimer: ReturnType<typeof setTimeout> | undefined;
  private statsTimer: ReturnType<typeof setInterval> | undefined;
  private blobUrl: string | null = null;
  // Bumped by stop() so a manifest that arrives late is ignored
  private session = 0;

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
    this.onStatus('Cargando…');
    log(`start mode=${mode}`);

    video.onplaying = () => {
      this.onStatus('');
      log(`playing mode=${mode}`);
      if (mode === 'native') {
        this.scheduleRecycle(url, mode);
      }
      clearInterval(this.statsTimer);
      this.statsTimer = setInterval(() => log(playbackStats(video)), STATS_MS);
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

    const session = this.session;
    fetchManifest(url).then((text) => {
      if (session !== this.session) {
        return;
      }
      log(`manifest ${text ? 'via app' : 'direct'}`);
      const src = text ? playlistBlobUrl(text, url) : url;
      this.blobUrl = text ? src : null;
      this.startHls(src, mode, fallback);
    });
  }

  private startHls(
    src: string,
    mode: Mode,
    fallback: (reason: string) => void,
  ): void {
    const video = this.video;
    let retries = 0;
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
    hls.loadSource(src);
    hls.attachMedia(video);
  }

  stop(): void {
    this.session++;
    clearTimeout(this.recycleTimer);
    clearInterval(this.statsTimer);
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
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
    }, NATIVE_RECYCLE_MS);
  }
}

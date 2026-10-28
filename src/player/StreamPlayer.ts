import {VideoPlayer} from '@amazon-devices/react-native-w3cmedia';
import {SHAKA_CONFIG} from './quality';
// Built by scripts/setup-shaka.sh (see README): Amazon's Vega port of Shaka
// Player and the polyfills it needs to run outside a browser
import shaka from '../vendor/shaka/shaka-player.compiled';
import DocumentPolyfill from '../vendor/polyfills/DocumentPolyfill';
import DOMParserPolyfill from '../vendor/polyfills/DOMParserPolyfill';
import ElementPolyfill from '../vendor/polyfills/ElementPolyfill';
import MiscPolyfill from '../vendor/polyfills/MiscPolyfill';
import TextDecoderPolyfill from '../vendor/polyfills/TextDecoderPolyfill';
import W3CMediaPolyfill from '../vendor/polyfills/W3CMediaPolyfill';

export type PlayerEvent =
  | {type: 'ready'} // metadata loaded: show the video surface
  | {type: 'playing'}
  | {type: 'waiting'}
  | {type: 'error'; message: string};

/** The parts of shaka.Player this class uses. */
interface ShakaPlayer {
  configure(config: object): void;
  load(url: string): Promise<void>;
  detach(): unknown;
  destroy(): unknown;
  addEventListener(type: 'error', listener: (e: ShakaErrorEvent) => void): void;
  removeEventListener(
    type: 'error',
    listener: (e: ShakaErrorEvent) => void,
  ): void;
}

interface ShakaErrorEvent {
  detail?: {code?: number; severity?: number};
}

/** shaka.util.Error.Severity.CRITICAL */
const CRITICAL = 2;

/** How long to wait for the native player to shut down. */
const DEINIT_TIMEOUT_MS = 1500;

let installed = false;

function install(): void {
  if (installed) {
    return;
  }
  DocumentPolyfill.install();
  ElementPolyfill.install();
  TextDecoderPolyfill.install();
  W3CMediaPolyfill.install();
  MiscPolyfill.install();
  DOMParserPolyfill.install();
  shaka.polyfill.installAll();
  // Use fetch() for every request; the default XHR plugin needs a browser
  for (const scheme of ['http', 'https']) {
    shaka.net.NetworkingEngine.unregisterScheme(scheme);
    shaka.net.NetworkingEngine.registerScheme(
      scheme,
      shaka.net.HttpFetchPlugin.parse,
      shaka.net.NetworkingEngine.PluginPriority.APPLICATION,
      true,
    );
  }
  installed = true;
}

/**
 * One live stream played with Vega's native media pipeline (W3C Media API)
 * and Shaka Player. Create one per stream and destroy() it before the next:
 * the device can't run two native players at once.
 *
 * Usage: load(url), render a KeplerVideoSurfaceView after the 'ready' event
 * and pass its handle to setSurface(); playback starts once both are done.
 */
export class StreamPlayer {
  private video: VideoPlayer | null = null;
  private shaka: ShakaPlayer | null = null;
  private surface: string | null = null;
  private loaded = false;
  private destroyed = false;

  constructor(private readonly onEvent: (e: PlayerEvent) => void) {}

  async load(url: string): Promise<void> {
    try {
      install();
      const video = new VideoPlayer();
      this.video = video;
      (globalThis as {gmedia?: unknown}).gmedia = video;
      await video.initialize();
      if (this.destroyed) {
        return this.release();
      }
      video.autoplay = false;
      video.addEventListener('loadedmetadata', this.onMetadata);
      video.addEventListener('playing', this.onPlaying);
      video.addEventListener('waiting', this.onWaiting);
      video.addEventListener('error', this.onVideoError);

      const player: ShakaPlayer = new shaka.Player(video);
      this.shaka = player;
      player.configure(SHAKA_CONFIG);
      player.addEventListener('error', this.onShakaError);
      await player.load(url);
      this.loaded = true;
      this.maybePlay();
    } catch (e) {
      if (!this.destroyed) {
        this.onEvent({type: 'error', message: describe(e)});
      }
    }
  }

  setSurface(handle: string): void {
    this.surface = handle;
    this.video?.setSurfaceHandle(handle);
    this.maybePlay();
  }

  clearSurface(handle: string): void {
    this.video?.clearSurfaceHandle(handle);
    this.surface = null;
  }

  /** Stops playback and frees the native player. Safe to call twice. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    // If initialize() is still running, load() releases when it returns
    if (this.video && (this.loaded || this.shaka)) {
      this.release();
    }
  }

  private maybePlay(): void {
    if (this.loaded && this.surface && this.video && !this.destroyed) {
      this.video.play();
    }
  }

  private release(): void {
    const video = this.video;
    this.video = null;
    try {
      video?.pause();
      video?.removeEventListener('loadedmetadata', this.onMetadata);
      video?.removeEventListener('playing', this.onPlaying);
      video?.removeEventListener('waiting', this.onWaiting);
      video?.removeEventListener('error', this.onVideoError);
      if (this.shaka) {
        this.shaka.removeEventListener('error', this.onShakaError);
        this.shaka.detach();
        this.shaka.destroy();
        this.shaka = null;
      }
      if (this.surface) {
        video?.clearSurfaceHandle(this.surface);
      }
      video?.deinitializeSync(DEINIT_TIMEOUT_MS);
    } catch {
      // the native player is going away anyway
    }
    (globalThis as {gmedia?: unknown}).gmedia = null;
  }

  private onMetadata = () => this.onEvent({type: 'ready'});
  private onPlaying = () => this.onEvent({type: 'playing'});
  private onWaiting = () => this.onEvent({type: 'waiting'});
  private onVideoError = () =>
    this.onEvent({type: 'error', message: 'error del reproductor'});
  private onShakaError = (e: ShakaErrorEvent) => {
    // Shaka retries recoverable errors itself
    if (e.detail?.severity === CRITICAL) {
      this.onEvent({type: 'error', message: describe(e.detail)});
    }
  };
}

function describe(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e) {
    return `Shaka ${(e as {code: number}).code}`;
  }
  return e instanceof Error ? e.message : String(e);
}

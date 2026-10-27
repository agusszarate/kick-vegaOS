/**
 * Messages exchanged between the React Native shell (src/App.tsx) and the
 * web UI running inside the WebView (web/src).
 *
 * Web -> native: strings sent with window.ReactNativeWebView.postMessage().
 * Native -> web: JavaScript injected with WebView.injectJavaScript().
 */

/** Screens of the web UI. The native shell needs it to route the Back key. */
export type View = 'home' | 'player' | 'search' | 'phone';

export type WebMessage =
  | {type: 'view'; view: View}
  | {type: 'log'; text: string}
  | {type: 'manifest'; id: number; url: string};

/** Global function the web UI exposes so the native shell can forward Back. */
export const BACK_HANDLER = '__kickBack';

/**
 * Global function the web UI exposes to receive a manifest the native shell
 * downloaded: (id, text) on success, (id, null) on failure.
 */
export const MANIFEST_HANDLER = '__kickManifest';

/**
 * Kick's master playlists (playback.live-video.net) only allow the
 * https://kick.com origin, so a page loaded from file:// can't read them,
 * while the variant playlists and segments allow any origin. The native shell,
 * which isn't bound by CORS, downloads just the master playlist, and only
 * from Amazon IVS.
 */
export function isManifestUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9.-]+\.live-video\.net\/[^\s]*$/i.test(url);
}

/** Script the native shell injects to hand a manifest back to the page. */
export function manifestScript(id: number, text: string | null): string {
  return `window.${MANIFEST_HANDLER} && window.${MANIFEST_HANDLER}(${id}, ${JSON.stringify(
    text,
  )}); true;`;
}

export function encodeMessage(msg: WebMessage): string {
  return JSON.stringify(msg);
}

export function decodeMessage(data: string): WebMessage | null {
  try {
    const msg = JSON.parse(data) as Partial<WebMessage>;
    if (msg && (msg.type === 'view' || msg.type === 'log')) {
      return msg as WebMessage;
    }
    if (
      msg?.type === 'manifest' &&
      typeof msg.id === 'number' &&
      typeof msg.url === 'string'
    ) {
      return msg as WebMessage;
    }
  } catch {
    // not one of ours
  }
  return null;
}

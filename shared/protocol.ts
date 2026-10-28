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
  | {type: 'fetch'; id: number; url: string};

/** Global function the web UI exposes so the native shell can forward Back. */
export const BACK_HANDLER = '__kickBack';

/**
 * Global function the web UI exposes to receive what the native shell
 * downloaded for it: (id, text) on success, (id, null) on failure.
 */
export const FETCH_HANDLER = '__kickFetch';

/**
 * A few Kick endpoints only allow the https://kick.com origin, so a page
 * loaded from file:// can't read them. The native shell, which isn't bound by
 * CORS, downloads them for the page, and only these:
 * - master playlists (*.live-video.net); the variant playlists and segments
 *   allow any origin, so hls.js loads those itself
 * - the list of live streams by language (web.kick.com), the only endpoint
 *   that still filters by language
 */
export function isNativeFetchUrl(url: string): boolean {
  return (
    /^https:\/\/[a-z0-9.-]+\.live-video\.net\/[^\s]*$/i.test(url) ||
    /^https:\/\/web\.kick\.com\/api\/v1\/livestreams\?[^\s#]*$/.test(url)
  );
}

/** Script the native shell injects to hand a download back to the page. */
export function fetchResultScript(id: number, text: string | null): string {
  return `window.${FETCH_HANDLER} && window.${FETCH_HANDLER}(${id}, ${JSON.stringify(
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
      msg?.type === 'fetch' &&
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

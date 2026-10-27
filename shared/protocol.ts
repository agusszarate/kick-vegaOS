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
  | {type: 'log'; text: string};

/** Global function the web UI exposes so the native shell can forward Back. */
export const BACK_HANDLER = '__kickBack';

export function encodeMessage(msg: WebMessage): string {
  return JSON.stringify(msg);
}

export function decodeMessage(data: string): WebMessage | null {
  try {
    const msg = JSON.parse(data) as Partial<WebMessage>;
    if (msg && (msg.type === 'view' || msg.type === 'log')) {
      return msg as WebMessage;
    }
  } catch {
    // not one of ours
  }
  return null;
}

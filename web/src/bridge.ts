import {encodeMessage, type View, type WebMessage} from '../../shared/protocol';

declare global {
  interface Window {
    ReactNativeWebView?: {postMessage(data: string): void};
  }
}

function post(msg: WebMessage): void {
  try {
    window.ReactNativeWebView?.postMessage(encodeMessage(msg));
  } catch {
    // running outside the app (e.g. a desktop browser)
  }
}

export function reportView(view: View): void {
  post({type: 'view', view});
}

/** Shows up in the device logs through the native shell's console. */
export function log(text: string): void {
  post({type: 'log', text});
}

import {
  MANIFEST_HANDLER,
  encodeMessage,
  type View,
  type WebMessage,
} from '../../shared/protocol';

declare global {
  interface Window {
    ReactNativeWebView?: {postMessage(data: string): void};
    [MANIFEST_HANDLER]?: (id: number, text: string | null) => void;
  }
}

const MANIFEST_TIMEOUT_MS = 8000;
const pending = new Map<number, (text: string | null) => void>();
let nextId = 1;

window[MANIFEST_HANDLER] = (id, text) => {
  pending.get(id)?.(text);
  pending.delete(id);
};

/**
 * Asks the native shell to download a master playlist the page isn't allowed
 * to read (see isManifestUrl). Resolves null if it can't, including when the
 * page runs outside the app.
 */
export function fetchManifest(url: string): Promise<string | null> {
  if (!window.ReactNativeWebView) {
    return Promise.resolve(null);
  }
  const id = nextId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve(null);
    }, MANIFEST_TIMEOUT_MS);
    pending.set(id, (text) => {
      clearTimeout(timer);
      resolve(text);
    });
    post({type: 'manifest', id, url});
  });
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

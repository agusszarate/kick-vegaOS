import qrcode from 'qrcode-generator';
import {slugFrom} from './kick';

/**
 * "Send from your phone": the TV listens on a private ntfy.sh topic. The
 * phone opens https://ntfy.sh/<topic> (from a QR code) and publishes a channel
 * name or a Kick link; the TV opens that channel.
 *
 * Only channel names travel through ntfy. Messages that don't contain a Kick
 * channel are ignored.
 */
export const NTFY_SERVER = 'https://ntfy.sh';

export function topicUrl(topic: string): string {
  return `${NTFY_SERVER}/${topic}`;
}

/** QR code modules for a URL: rows of dark (true) and light (false) squares. */
export function qrMatrix(url: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({length: n}, (_r, row) =>
    Array.from({length: n}, (_c, col) => qr.isDark(row, col)),
  );
}

interface NtfyEvent {
  event: string;
  message?: string;
  title?: string;
  click?: string;
}

/** Extracts the channel a phone message points to, if any. */
export function slugFromNtfy(
  raw: string,
): {slug: string | null; text: string} | null {
  let data: NtfyEvent;
  try {
    data = JSON.parse(raw) as NtfyEvent;
  } catch {
    return null;
  }
  if (data.event !== 'message') {
    return null;
  }
  return {
    slug:
      slugFrom(data.message) || slugFrom(data.click) || slugFrom(data.title),
    text: data.message || '',
  };
}

const RECONNECT_MS = [2000, 5000, 15000, 60000];

/**
 * Calls onSlug for every channel sent to the topic, reconnecting when the
 * connection drops. Returns a function that stops listening.
 */
export function listen(
  topic: string,
  onSlug: (slug: string) => void,
  onUnknown: (text: string) => void,
): () => void {
  let ws: WebSocket | null = null;
  let timer = 0;
  let failures = 0;
  let stopped = false;

  const connect = () => {
    ws = new WebSocket(`${topicUrl(topic).replace(/^http/, 'ws')}/ws`);
    ws.onopen = () => (failures = 0);
    ws.onmessage = (ev) => {
      const parsed = slugFromNtfy(String(ev.data));
      if (!parsed) {
        return;
      }
      if (parsed.slug) {
        onSlug(parsed.slug);
      } else {
        onUnknown(parsed.text);
      }
    };
    ws.onclose = () => {
      if (!stopped) {
        const wait =
          RECONNECT_MS[Math.min(failures++, RECONNECT_MS.length - 1)];
        timer = setTimeout(connect, wait);
      }
    };
  };

  connect();
  return () => {
    stopped = true;
    clearTimeout(timer);
    ws?.close();
  };
}

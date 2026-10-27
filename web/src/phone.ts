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

export function qrImageTag(url: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr.createImgTag(8, 0);
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

/** Calls onSlug for every channel sent to the topic. EventSource reconnects on its own. */
export function listen(
  topic: string,
  onSlug: (slug: string) => void,
  onUnknown: (text: string) => void,
): void {
  let es: EventSource;
  try {
    es = new EventSource(`${topicUrl(topic)}/sse`);
  } catch {
    return;
  }
  es.onmessage = (ev) => {
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
}

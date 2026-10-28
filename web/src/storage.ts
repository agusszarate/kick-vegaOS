const FAVS_KEY = 'kick-vegaos.favs';
const TOPIC_KEY = 'kick-vegaos.topic';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable: favorites just won't persist
  }
}

/** Channel slugs the user saved as "Mis canales". */
export const favorites = {
  list(): string[] {
    return read<string[]>(FAVS_KEY, []);
  },
  has(slug: string): boolean {
    return this.list().includes(slug);
  },
  add(slug: string): void {
    const l = this.list();
    if (!l.includes(slug)) {
      write(FAVS_KEY, [...l, slug]);
    }
  },
  /** Returns true if the slug is a favorite after toggling. */
  toggle(slug: string): boolean {
    const l = this.list();
    if (l.includes(slug)) {
      write(
        FAVS_KEY,
        l.filter((s) => s !== slug),
      );
      return false;
    }
    write(FAVS_KEY, [...l, slug]);
    return true;
  },
};

/**
 * Random, hard-to-guess ntfy topic for this device, created on first run.
 * Anyone who knows it can make the TV open a Kick channel, nothing more.
 */
export function phoneTopic(): string {
  let topic = read<string | null>(TOPIC_KEY, null);
  if (!topic) {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    topic =
      'kick-vegaos-' +
      Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    write(TOPIC_KEY, topic);
  }
  return topic;
}

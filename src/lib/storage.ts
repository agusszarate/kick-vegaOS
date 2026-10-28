import AsyncStorage from '@amazon-devices/react-native-async-storage__async-storage';

const FAVS_KEY = 'kick-vegaos.favs';
const TOPIC_KEY = 'kick-vegaos.topic';

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: favorites just won't persist
  }
}

/** Channel slugs the user saved as "Mis canales". */
export function loadFavorites(): Promise<string[]> {
  return read<string[]>(FAVS_KEY, []);
}

export function saveFavorites(slugs: string[]): Promise<void> {
  return write(FAVS_KEY, slugs);
}

/** Adds the slug if missing, removes it otherwise. */
export function toggled(slugs: string[], slug: string): string[] {
  return slugs.includes(slug)
    ? slugs.filter((s) => s !== slug)
    : [...slugs, slug];
}

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);
  const c = (globalThis as {crypto?: {getRandomValues?: Function}}).crypto;
  if (c?.getRandomValues) {
    c.getRandomValues(values);
  } else {
    for (let i = 0; i < bytes; i++) {
      values[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(values, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Random, hard-to-guess ntfy topic for this device, created on first run.
 * Anyone who knows it can make the TV open a Kick channel, nothing more.
 */
export async function phoneTopic(): Promise<string> {
  let topic = await read<string | null>(TOPIC_KEY, null);
  if (!topic) {
    topic = 'kick-vegaos-' + randomHex(10);
    await write(TOPIC_KEY, topic);
  }
  return topic;
}

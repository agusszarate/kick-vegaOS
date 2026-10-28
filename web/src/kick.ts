/**
 * Minimal client for Kick's public web endpoints.
 *
 * These are the same (undocumented) endpoints kick.com uses. Most allow
 * cross-origin requests, so the WebView calls them directly; the live streams
 * by language only allow kick.com and go through the native shell.
 */

import {nativeFetch} from './bridge';

const API = 'https://kick.com';
const WEB_API = 'https://web.kick.com/api/v1';

export interface Channel {
  slug: string;
  name: string;
  avatar?: string;
  live: boolean;
  title: string;
  viewers: number;
  thumb?: string;
  /** HLS playlist. Its token expires, so fetch the channel again before playing. */
  playback?: string;
}

// Subsets of the API responses that we use
export interface ApiChannel {
  slug: string;
  playback_url?: string;
  user?: {username?: string; profile_pic?: string | null};
  livestream?: {
    session_title?: string;
    viewer_count?: number;
    thumbnail?: {url?: string} | null;
  } | null;
}

export interface ApiLivestream {
  session_title?: string;
  viewer_count?: number;
  thumbnail?: {src?: string} | null;
  channel: {
    slug: string;
    playback_url?: string;
    user?: {username?: string; profilepic?: string | null};
  };
}

// web.kick.com/api/v1/livestreams
export interface ApiWebLivestream {
  title?: string;
  viewer_count?: number;
  thumbnail?: {src?: string} | null;
  channel: {slug: string; username?: string; profile_pic?: string | null};
}

export function fromChannel(c: ApiChannel): Channel {
  const ls = c.livestream;
  return {
    slug: c.slug,
    name: c.user?.username || c.slug,
    avatar: c.user?.profile_pic || undefined,
    live: !!ls,
    title: ls ? ls.session_title || '' : 'Desconectado',
    viewers: ls?.viewer_count || 0,
    thumb: ls?.thumbnail?.url || undefined,
    playback: c.playback_url,
  };
}

export function fromLivestream(s: ApiLivestream): Channel {
  return {
    slug: s.channel.slug,
    name: s.channel.user?.username || s.channel.slug,
    avatar: s.channel.user?.profilepic || undefined,
    live: true,
    title: s.session_title || '',
    viewers: s.viewer_count || 0,
    thumb: s.thumbnail?.src || undefined,
    playback: s.channel.playback_url,
  };
}

export function fromWebLivestream(s: ApiWebLivestream): Channel {
  return {
    slug: s.channel.slug,
    name: s.channel.username || s.channel.slug,
    avatar: s.channel.profile_pic || undefined,
    live: true,
    title: s.title || '',
    viewers: s.viewer_count || 0,
    thumb: s.thumbnail?.src || undefined,
  };
}

/**
 * Extracts a channel slug from free text: "coscu", "@coscu",
 * "kick.com/coscu" or "https://kick.com/coscu?x=1".
 */
export function slugFrom(text: string | null | undefined): string | null {
  if (!text) {
    return null;
  }
  const t = String(text).trim();
  let m = t.match(/kick\.com\/(?:popout\/)?([A-Za-z0-9_-]+)/i);
  if (m) {
    return m[1].toLowerCase();
  }
  m = t.match(/^@?([A-Za-z0-9_-]{2,25})$/);
  return m ? m[1].toLowerCase() : null;
}

/** Live channels first, then by audience. */
export function byLiveThenViewers(a: Channel, b: Channel): number {
  return Number(b.live) - Number(a.live) || b.viewers - a.viewers;
}

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(API + path, {headers: {Accept: 'application/json'}});
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} ${path}`);
  }
  return (await r.json()) as T;
}

export async function getChannel(slug: string): Promise<Channel> {
  return fromChannel(
    await getJSON<ApiChannel>(`/api/v2/channels/${encodeURIComponent(slug)}`),
  );
}

/** Like getChannel, but resolves to null instead of failing. */
export function tryGetChannel(slug: string): Promise<Channel | null> {
  return getChannel(slug).catch(() => null);
}

/** Most watched live streams in a language (ISO 639-1 code). */
export async function getLiveStreams(
  language = 'es',
  limit = 24,
  fetchText = nativeFetch,
): Promise<Channel[]> {
  const text = await fetchText(
    `${WEB_API}/livestreams?limit=${limit}&sort=viewer_count_desc&language=${encodeURIComponent(
      language,
    )}`,
  );
  if (text) {
    const d = JSON.parse(text) as {data?: {livestreams?: ApiWebLivestream[]}};
    return (d.data?.livestreams || []).map(fromWebLivestream);
  }
  // Outside the app (e.g. a desktop browser while developing). This endpoint
  // no longer filters by language: it returns the top streams of every one.
  const d = await getJSON<{data?: ApiLivestream[]}>(
    `/stream/livestreams/${language}?page=1&limit=${limit}&sort=desc`,
  );
  return (d.data || []).map(fromLivestream);
}

export async function searchChannels(
  query: string,
  max = 10,
): Promise<Channel[]> {
  const d = await getJSON<{channels?: {slug: string}[]}>(
    `/api/search?searched_word=${encodeURIComponent(query.trim())}`,
  );
  const slugs = (d.channels || []).slice(0, max).map((c) => c.slug);
  const list = await Promise.all(slugs.map(tryGetChannel));
  return list.filter((c): c is Channel => c !== null).sort(byLiveThenViewers);
}

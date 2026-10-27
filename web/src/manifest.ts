/**
 * A master playlist served from a blob: URL has no base to resolve relative
 * URIs against, so make every URI in it absolute first: plain URI lines and
 * URI="..." attributes (EXT-X-MEDIA, EXT-X-I-FRAME-STREAM-INF...).
 */
export function absolutizePlaylist(text: string, base: string): string {
  const abs = (uri: string) => {
    try {
      return new URL(uri, base).href;
    } catch {
      return uri;
    }
  };
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return line;
      }
      if (trimmed.startsWith('#')) {
        return line.replace(
          /URI="([^"]*)"/g,
          (_m, uri: string) => `URI="${abs(uri)}"`,
        );
      }
      return abs(trimmed);
    })
    .join('\n');
}

/** Blob URL hls.js can load the (absolutized) master playlist from. */
export function playlistBlobUrl(text: string, base: string): string {
  const blob = new Blob([absolutizePlaylist(text, base)], {
    type: 'application/vnd.apple.mpegurl',
  });
  return URL.createObjectURL(blob);
}

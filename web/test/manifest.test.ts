import {
  decodeMessage,
  fetchResultScript,
  isNativeFetchUrl,
} from '../../shared/protocol';
import {absolutizePlaylist} from '../src/manifest';

describe('isNativeFetchUrl', () => {
  it('accepts Amazon IVS playlists and the live streams list only', () => {
    expect(
      isNativeFetchUrl(
        'https://fa7.us-west-2.playback.live-video.net/api/video/v1/x.m3u8?token=a',
      ),
    ).toBe(true);
    expect(isNativeFetchUrl('http://a.playback.live-video.net/x.m3u8')).toBe(
      false,
    );
    expect(isNativeFetchUrl('https://live-video.net.evil.com/x.m3u8')).toBe(
      false,
    );
    expect(isNativeFetchUrl('https://evil.com/?live-video.net/')).toBe(false);
    expect(isNativeFetchUrl('file:///etc/passwd')).toBe(false);
    expect(
      isNativeFetchUrl(
        'https://web.kick.com/api/v1/livestreams?limit=24&language=es',
      ),
    ).toBe(true);
    expect(isNativeFetchUrl('https://web.kick.com/api/v1/users/me')).toBe(
      false,
    );
    expect(isNativeFetchUrl('https://kick.com/api/v2/channels/x')).toBe(false);
  });
});

describe('fetch messages', () => {
  it('decodes manifest requests and rejects malformed ones', () => {
    expect(decodeMessage('{"type":"fetch","id":3,"url":"https://x"}')).toEqual({
      type: 'fetch',
      id: 3,
      url: 'https://x',
    });
    expect(
      decodeMessage('{"type":"fetch","id":"3","url":"https://x"}'),
    ).toBeNull();
  });

  it('builds an injectable script that escapes the playlist', () => {
    const script = fetchResultScript(7, '#EXTM3U\n"quoted"</script>');
    expect(script).toContain(
      'window.__kickFetch(7, "#EXTM3U\\n\\"quoted\\"</script>")',
    );
    expect(fetchResultScript(8, null)).toContain('(8, null)');
  });
});

describe('absolutizePlaylist', () => {
  const base = 'https://a.playback.live-video.net/api/video/v1/ch.m3u8?token=t';

  it('resolves relative URIs and URI attributes, keeps absolute ones', () => {
    const text = [
      '#EXTM3U',
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",URI="audio/a.m3u8"',
      '#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720',
      'https://b.playlist.live-video.net/v1/playlist/x.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=852x480',
      'low/index.m3u8',
      '',
    ].join('\n');
    expect(absolutizePlaylist(text, base).split('\n')).toEqual([
      '#EXTM3U',
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",URI="https://a.playback.live-video.net/api/video/v1/audio/a.m3u8"',
      '#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720',
      'https://b.playlist.live-video.net/v1/playlist/x.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=852x480',
      'https://a.playback.live-video.net/api/video/v1/low/index.m3u8',
      '',
    ]);
  });
});

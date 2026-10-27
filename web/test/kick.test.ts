import {
  byLiveThenViewers,
  fromChannel,
  fromLivestream,
  slugFrom,
  type Channel,
} from '../src/kick';

describe('slugFrom', () => {
  it.each([
    ['coscu', 'coscu'],
    ['  Coscu ', 'coscu'],
    ['@coscu', 'coscu'],
    ['kick.com/coscu', 'coscu'],
    ['https://kick.com/coscu?ref=share', 'coscu'],
    ['https://www.kick.com/popout/coscu/chat', 'coscu'],
    ['mirá esto https://kick.com/el_dave-99 !!', 'el_dave-99'],
  ])('%j -> %j', (text, slug) => {
    expect(slugFrom(text)).toBe(slug);
  });

  it.each([
    '',
    'hola que tal',
    'x',
    'https://twitch.tv/coscu',
    null,
    undefined,
  ])('rejects %j', (text) => {
    expect(slugFrom(text)).toBeNull();
  });
});

describe('fromChannel', () => {
  it('maps a live channel', () => {
    expect(
      fromChannel({
        slug: 'coscu',
        playback_url: 'https://x/y.m3u8',
        user: {username: 'Coscu', profile_pic: 'https://img/p.webp'},
        livestream: {
          session_title: 'Hola',
          viewer_count: 1234,
          thumbnail: {url: 'https://img/t.webp'},
        },
      }),
    ).toEqual({
      slug: 'coscu',
      name: 'Coscu',
      avatar: 'https://img/p.webp',
      live: true,
      title: 'Hola',
      viewers: 1234,
      thumb: 'https://img/t.webp',
      playback: 'https://x/y.m3u8',
    });
  });

  it('maps an offline channel without a user', () => {
    const c = fromChannel({slug: 'nadie', livestream: null});
    expect(c).toMatchObject({
      name: 'nadie',
      live: false,
      viewers: 0,
      title: 'Desconectado',
    });
    expect(c.avatar).toBeUndefined();
  });
});

describe('fromLivestream', () => {
  it('maps an item of the live list (note: profilepic, not profile_pic)', () => {
    expect(
      fromLivestream({
        session_title: 'Partido',
        viewer_count: 47048,
        thumbnail: {src: 'https://img/720.webp'},
        channel: {
          slug: 'lacobraaa',
          playback_url: 'https://x.m3u8',
          user: {username: 'LACOBRAAA', profilepic: 'https://img/a.png'},
        },
      }),
    ).toMatchObject({
      slug: 'lacobraaa',
      name: 'LACOBRAAA',
      avatar: 'https://img/a.png',
      live: true,
      viewers: 47048,
    });
  });
});

describe('byLiveThenViewers', () => {
  const ch = (slug: string, live: boolean, viewers: number): Channel => ({
    slug,
    name: slug,
    live,
    viewers,
    title: '',
  });

  it('puts live channels first, most watched first', () => {
    const sorted = [
      ch('a', false, 0),
      ch('b', true, 10),
      ch('c', true, 500),
      ch('d', false, 0),
    ].sort(byLiveThenViewers);
    expect(sorted.map((c) => c.slug)).toEqual(['c', 'b', 'a', 'd']);
  });
});

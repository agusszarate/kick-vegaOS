jest.mock('@amazon-devices/react-native-async-storage__async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import {clamp, move} from '../src/lib/focus';
import {formatViewers} from '../src/lib/format';
import type {Channel} from '../src/lib/kick';
import {qrMatrix, slugFromNtfy, topicUrl} from '../src/lib/phone';
import {homeRows, zapTarget} from '../src/lib/rows';
import {toggled} from '../src/lib/storage';
import {MAX_HEIGHT, SHAKA_CONFIG} from '../src/player/quality';

describe('focus', () => {
  // actions row (2), empty search results, favorites (3), live (10)
  const rows = [2, 0, 3, 10];

  it('skips empty rows going down and up', () => {
    expect(move({row: 0, col: 0}, rows, 1, 0)).toEqual({row: 2, col: 0});
    expect(move({row: 2, col: 0}, rows, -1, 0)).toEqual({row: 0, col: 0});
  });

  it('stays put at the first and last rows', () => {
    expect(move({row: 0, col: 1}, rows, -1, 0)).toEqual({row: 0, col: 1});
    expect(move({row: 3, col: 4}, rows, 1, 0)).toEqual({row: 3, col: 4});
  });

  it('clamps the column to the new row length', () => {
    expect(move({row: 3, col: 9}, rows, -1, 0)).toEqual({row: 2, col: 2});
  });

  it('stops at the row edges', () => {
    expect(move({row: 0, col: 1}, rows, 0, 1)).toEqual({row: 0, col: 1});
    expect(move({row: 0, col: 0}, rows, 0, -1)).toEqual({row: 0, col: 0});
  });

  it('clamp handles rows that shrank after a refresh', () => {
    expect(clamp({row: 7, col: 7}, [2, 3])).toEqual({row: 1, col: 2});
    expect(clamp({row: 1, col: 5}, [2, 0])).toEqual({row: 1, col: 0});
  });
});

describe('slugFromNtfy', () => {
  it('reads the channel from a message event', () => {
    expect(
      slugFromNtfy('{"event":"message","message":"https://kick.com/coscu"}'),
    ).toEqual({
      slug: 'coscu',
      text: 'https://kick.com/coscu',
    });
  });

  it('falls back to the click URL', () => {
    expect(
      slugFromNtfy(
        '{"event":"message","message":"mirá","click":"https://kick.com/spreen"}',
      )?.slug,
    ).toBe('spreen');
  });

  it('reports messages without a channel', () => {
    expect(
      slugFromNtfy('{"event":"message","message":"hola que tal"}'),
    ).toEqual({slug: null, text: 'hola que tal'});
  });

  it('ignores keepalives and garbage', () => {
    expect(slugFromNtfy('{"event":"keepalive"}')).toBeNull();
    expect(slugFromNtfy('not json')).toBeNull();
  });
});

describe('formatViewers', () => {
  it('formats viewer counts', () => {
    expect(formatViewers(0)).toBe('0');
    expect(formatViewers(950)).toBe('950');
    expect(formatViewers(1234)).toBe('1.2 mil');
    expect(formatViewers(47048)).toBe('47 mil');
  });
});

describe('quality', () => {
  it('caps video at 720p and evicts what was already played', () => {
    expect(SHAKA_CONFIG.abr.restrictions.maxHeight).toBe(MAX_HEIGHT);
    expect(MAX_HEIGHT).toBe(720);
    expect(SHAKA_CONFIG.streaming.bufferBehind).toBeLessThanOrEqual(10);
  });

  it("doesn't stream text, so Kick's metadata never piles up as cues", () => {
    expect(SHAKA_CONFIG.streaming.alwaysStreamText).toBe(false);
  });
});

const channel = (slug: string, live = true): Channel => ({
  slug,
  name: slug,
  live,
  title: '',
  viewers: 0,
});

describe('homeRows', () => {
  it('puts search results between the actions and the favorites', () => {
    const search = {id: 'search' as const, title: 'R', items: []};
    expect(homeRows([], [], search).map((r) => r.id)).toEqual([
      'actions',
      'search',
      'favs',
      'live',
    ]);
    expect(homeRows([], [], null).map((r) => r.id)).toEqual([
      'actions',
      'favs',
      'live',
    ]);
  });

  it('tells a failed live list from an empty one', () => {
    expect(homeRows([], null, null)[2].empty).toMatch(/No se pudo/);
    expect(homeRows([], [], null)[2].empty).toMatch(/No hay/);
  });
});

describe('zapTarget', () => {
  const list = [
    channel('a'),
    channel('off', false),
    channel('b'),
    channel('c'),
  ];

  it('moves through live channels only, wrapping around', () => {
    expect(zapTarget(list, 'a', 1)?.slug).toBe('b');
    expect(zapTarget(list, 'c', 1)?.slug).toBe('a');
    expect(zapTarget(list, 'a', -1)?.slug).toBe('c');
  });

  it('starts from the ends when the current channel is not in the list', () => {
    expect(zapTarget(list, 'zzz', 1)?.slug).toBe('a');
    expect(zapTarget(list, 'zzz', -1)?.slug).toBe('c');
  });

  it('needs at least two live channels', () => {
    expect(zapTarget([channel('a'), channel('x', false)], 'a', 1)).toBeNull();
  });
});

describe('favorites', () => {
  it('toggles a slug in and out', () => {
    expect(toggled(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggled(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('qrMatrix', () => {
  it('builds a square QR with the finder pattern in the corner', () => {
    const m = qrMatrix(topicUrl('kick-vegaos-0123456789abcdef0123'));
    expect(m.length).toBeGreaterThanOrEqual(21);
    expect(m.every((row) => row.length === m.length)).toBe(true);
    // Top-left finder pattern: a 7x7 dark frame
    expect(m[0].slice(0, 7).every(Boolean)).toBe(true);
    expect(m[1][1]).toBe(false);
  });
});

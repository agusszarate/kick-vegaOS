import {decodeMessage, encodeMessage} from '../../shared/protocol';
import {clamp, move} from '../src/focus';
import {remoteKey} from '../src/keys';
import {slugFromNtfy} from '../src/phone';
import {HLS_CONFIG, levelCap} from '../src/quality';
import {escapeHtml, formatViewers} from '../src/util';

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

describe('remoteKey', () => {
  it('maps the d-pad and OK', () => {
    expect(remoteKey({key: 'ArrowUp', keyCode: 38})).toBe('up');
    expect(remoteKey({key: 'ArrowRight', keyCode: 39})).toBe('right');
    expect(remoteKey({key: 'Enter', keyCode: 13})).toBe('ok');
    expect(remoteKey({key: 'Unidentified', keyCode: 23})).toBe('ok');
  });

  it('maps every flavour of Back', () => {
    for (const e of [
      {key: 'Escape', keyCode: 27},
      {key: 'GoBack', keyCode: 0},
      {key: 'BrowserBack', keyCode: 166},
      {key: 'Unidentified', keyCode: 461},
      {key: 'Backspace', keyCode: 8},
    ]) {
      expect(remoteKey(e)).toBe('back');
    }
  });

  it('lets Backspace edit text while typing', () => {
    expect(remoteKey({key: 'Backspace', keyCode: 8}, true)).toBeNull();
    expect(remoteKey({key: 'a', keyCode: 65})).toBeNull();
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

describe('quality', () => {
  const kickLevels = [
    {height: 480},
    {height: 360},
    {height: 160},
    {height: 1080},
    {height: 720},
  ];

  it('caps at the best level not above 720p', () => {
    expect(levelCap(kickLevels)).toBe(4);
    expect(levelCap(kickLevels, 480)).toBe(0);
  });

  it('returns -1 when every level is too tall', () => {
    expect(levelCap([{height: 1080}])).toBe(-1);
  });

  it('keeps the metadata cues that leaked memory disabled', () => {
    expect(HLS_CONFIG).toMatchObject({
      enableID3MetadataCues: false,
      enableDateRangeMetadataCues: false,
      backBufferLength: 0,
    });
  });
});

describe('util', () => {
  it('formats viewer counts', () => {
    expect(formatViewers(0)).toBe('0');
    expect(formatViewers(950)).toBe('950');
    expect(formatViewers(1234)).toBe('1.2 mil');
    expect(formatViewers(47048)).toBe('47 mil');
  });

  it('escapes html', () => {
    expect(escapeHtml(`<b a="1">'&'</b>`)).toBe(
      '&lt;b a=&quot;1&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;',
    );
  });
});

describe('protocol', () => {
  it('round-trips messages and ignores foreign ones', () => {
    expect(
      decodeMessage(encodeMessage({type: 'view', view: 'player'})),
    ).toEqual({type: 'view', view: 'player'});
    expect(decodeMessage('view:home')).toBeNull();
    expect(decodeMessage('{"type":"other"}')).toBeNull();
  });
});

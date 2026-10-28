import * as React from 'react';
import {act, render, screen, waitFor} from '@testing-library/react-native';
import {App} from '../src/App';

type Key = {eventType: string; eventKeyAction: number};
let mockKey: (e: Key) => void;
let mockBack: () => boolean;

jest.mock('@amazon-devices/react-native-kepler', () => {
  const actual = jest.requireActual('@amazon-devices/react-native-kepler');
  const overrides: Record<string, unknown> = {
    usePreventHideSplashScreen: jest.fn(),
    useHideSplashScreenCallback: () => jest.fn(),
    useTVEventHandler: (handler: (e: Key) => void) => {
      mockKey = handler;
    },
    BackHandler: {
      addEventListener: (_name: string, handler: () => boolean) => {
        mockBack = handler;
        return {remove: jest.fn()};
      },
    },
  };
  // The real module only has getters, so shadow them on a derived object
  return Object.create(
    actual,
    Object.fromEntries(
      Object.entries(overrides).map(([k, value]) => [k, {value}]),
    ),
  );
});

jest.mock('@amazon-devices/react-native-async-storage__async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));

jest.mock('@amazon-devices/react-native-w3cmedia', () => ({
  KeplerVideoSurfaceView: 'KeplerVideoSurfaceView',
}));

const mockLoad = jest.fn();
const mockDestroy = jest.fn();
jest.mock('../src/player/StreamPlayer', () => ({
  StreamPlayer: jest.fn().mockImplementation(() => ({
    load: mockLoad,
    destroy: mockDestroy,
    setSurface: jest.fn(),
    clearSurface: jest.fn(),
  })),
}));

const PLAYBACK = 'https://x.playback.live-video.net/naim.m3u8';

function respond(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

beforeAll(() => {
  globalThis.fetch = jest.fn((url: string) =>
    url.includes('web.kick.com')
      ? respond({
          data: {
            livestreams: [
              {
                title: 'Hola',
                viewer_count: 7902,
                channel: {slug: 'naim', username: 'Naim'},
              },
            ],
          },
        })
      : respond({
          slug: 'naim',
          playback_url: PLAYBACK,
          user: {username: 'Naim'},
          livestream: {session_title: 'Hola', viewer_count: 7902},
        }),
  ) as unknown as typeof fetch;
  // ntfy: never connects in tests
  globalThis.WebSocket = jest.fn(() => ({close: jest.fn()})) as never;
});

beforeEach(() => {
  mockLoad.mockClear();
  mockDestroy.mockClear();
});

function press(eventType: string) {
  act(() => mockKey({eventType, eventKeyAction: 0}));
}

async function renderHome() {
  render(<App />);
  await screen.findByText('Naim');
}

describe('App', () => {
  it('lets Back exit the app from the home screen', async () => {
    await renderHome();
    expect(mockBack()).toBe(false);
  });

  it('opens search with OK and closes it with Back', async () => {
    await renderHome();
    press('select');
    expect(screen.getByPlaceholderText('Nombre del canal')).toBeTruthy();

    act(() => {
      expect(mockBack()).toBe(true);
    });
    expect(screen.queryByPlaceholderText('Nombre del canal')).toBeNull();
  });

  it('plays a live channel and goes back home with Back', async () => {
    await renderHome();
    press('down'); // "Mis canales" is empty, so this lands on the live row
    press('select');

    await waitFor(() => expect(mockLoad).toHaveBeenCalledWith(PLAYBACK));
    expect(screen.queryByText('kick-vegaOS')).toBeNull();

    act(() => {
      expect(mockBack()).toBe(true);
    });
    expect(mockDestroy).toHaveBeenCalled();
    await screen.findByText('kick-vegaOS');
  });

  it('ignores key releases', async () => {
    await renderHome();
    act(() => mockKey({eventType: 'select', eventKeyAction: 1}));
    expect(screen.queryByPlaceholderText('Nombre del canal')).toBeNull();
  });
});

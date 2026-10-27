import * as React from 'react';
import {act, render} from '@testing-library/react-native';
import {App} from '../src/App';
import {encodeMessage} from '../shared/protocol';

const mockInject = jest.fn();
let mockWebViewProps: {onMessage: (e: {nativeEvent: {data: string}}) => void};

jest.mock('@amazon-devices/webview', () => {
  const ReactMock = require('react');
  return {
    WebView: ReactMock.forwardRef(
      (props: typeof mockWebViewProps, ref: React.Ref<unknown>) => {
        mockWebViewProps = props;
        ReactMock.useImperativeHandle(ref, () => ({
          injectJavaScript: mockInject,
        }));
        return null;
      },
    ),
  };
});

let mockBack: () => boolean;
jest.mock('@amazon-devices/react-native-kepler', () => ({
  usePreventHideSplashScreen: jest.fn(),
  useHideSplashScreenCallback: jest.fn(() => jest.fn()),
  StyleSheet: {create: (styles: unknown) => styles},
  View: 'View',
  BackHandler: {
    addEventListener: (_name: string, handler: () => boolean) => {
      mockBack = handler;
      return {remove: jest.fn()};
    },
  },
}));

function pageSays(view: 'home' | 'player') {
  act(() =>
    mockWebViewProps.onMessage({
      nativeEvent: {data: encodeMessage({type: 'view', view})},
    }),
  );
}

describe('App', () => {
  beforeEach(() => mockInject.mockClear());

  it('lets Back exit the app from the home screen', () => {
    render(<App />);
    expect(mockBack()).toBe(false);
    expect(mockInject).not.toHaveBeenCalled();
  });

  it('forwards Back to the page while a stream is playing', () => {
    render(<App />);
    pageSays('player');
    expect(mockBack()).toBe(true);
    expect(mockInject).toHaveBeenCalledWith(
      expect.stringContaining('__kickBack'),
    );

    pageSays('home');
    expect(mockBack()).toBe(false);
  });
});

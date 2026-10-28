import {WebView} from '@amazon-devices/webview';
import * as React from 'react';
import {useEffect, useRef} from 'react';
import {BackHandler, View, StyleSheet} from 'react-native';
import {
  useHideSplashScreenCallback,
  usePreventHideSplashScreen,
} from '@amazon-devices/react-native-kepler';
import {
  SslErrorData,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
} from '@amazon-devices/webview/dist/types/WebViewTypes';
import {
  BACK_HANDLER,
  decodeMessage,
  fetchResultScript,
  isNativeFetchUrl,
  type View as PageView,
} from '../shared/protocol';

/** Downloads what the page can't read itself (see isNativeFetchUrl). */
async function nativeFetch(url: string): Promise<string | null> {
  if (!isNativeFetchUrl(url)) {
    return null;
  }
  try {
    const res = await fetch(url);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/**
 * Native shell: a full-screen WebView that runs the UI in assets/ (built from
 * web/src). The shell only hides the splash screen, forwards the Back key to
 * the page, downloads the few Kick URLs the page can't read, and relays the
 * page's logs to the device log.
 */
export const App = () => {
  const webRef = useRef<React.ElementRef<typeof WebView>>(null);
  // Screen the page is showing, reported by the page itself
  const pageView = useRef<PageView>('home');

  // Back goes to the page first; it only exits the app from the home screen
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pageView.current === 'home') {
        return false;
      }
      webRef.current?.injectJavaScript(
        `window.${BACK_HANDLER} && window.${BACK_HANDLER}(); true;`,
      );
      return true;
    });
    return () => sub.remove();
  }, []);

  // Keep the splash screen until the page has loaded
  usePreventHideSplashScreen();
  const hideSplashScreenCallback = useHideSplashScreenCallback();

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        style={styles.webview}
        allowSystemKeyEvents
        allowsDefaultMediaControl
        domStorageEnabled
        hasTVPreferredFocus
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
        source={{uri: 'file:///pkg/assets/index.html'}}
        onMessage={(event: {nativeEvent: {data: string}}) => {
          const msg = decodeMessage(event.nativeEvent.data);
          if (msg?.type === 'view') {
            pageView.current = msg.view;
          } else if (msg?.type === 'log') {
            console.warn(`[kick-vegaOS] ${msg.text}`);
          } else if (msg?.type === 'fetch') {
            nativeFetch(msg.url).then((text) =>
              webRef.current?.injectJavaScript(fetchResultScript(msg.id, text)),
            );
          }
        }}
        onLoad={() => hideSplashScreenCallback()}
        onError={({
          nativeEvent: {code, url, description},
        }: WebViewErrorEvent) => {
          console.error(`[onError]: (${code}: ${url}) ${description}`);
        }}
        onHttpError={({
          nativeEvent: {url, statusCode: code, description, isMainFrame},
        }: WebViewHttpErrorEvent) => {
          console.error(
            `[onHttpError]: (${code}: ${url}) ${description} mainFrame=${isMainFrame}`,
          );
        }}
        onSslError={({code, url, description}: SslErrorData) => {
          console.error(`[onSslError]: (${code}: ${url}) ${description}`);
        }}
      />
    </View>
  );
};

// Styles for layout, which are necessary for proper focus behavior
const styles = StyleSheet.create({
  container: {flex: 1},
  webview: {backgroundColor: '#000000'},
});

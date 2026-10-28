import {
  useHideSplashScreenCallback,
  usePreventHideSplashScreen,
  useTVEventHandler,
} from '@amazon-devices/react-native-kepler';
import type {HWEvent} from '@amazon-devices/react-native-kepler/Libraries/TV/TVTypes';
import * as React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {BackHandler, StyleSheet, View} from 'react-native';
import {clamp, move, type Focus} from './lib/focus';
import {formatTime} from './lib/format';
import {
  byLiveThenViewers,
  getChannel,
  getLiveStreams,
  searchChannels,
  tryGetChannel,
  type Channel,
} from './lib/kick';
import {listen} from './lib/phone';
import {homeRows, isAction, zapTarget, type Row} from './lib/rows';
import {loadFavorites, phoneTopic, saveFavorites, toggled} from './lib/storage';
import type {PlayerEvent} from './player/StreamPlayer';
import {HomeScreen} from './screens/HomeScreen';
import {PhoneOverlay, SearchOverlay, Toast} from './screens/Overlays';
import {PlayerScreen} from './screens/PlayerScreen';
import {colors} from './ui/theme';

/** How often the home screen refreshes live status while visible. */
const REFRESH_MS = 90 * 1000;
const OSD_MS = 5000;
const TOAST_MS = 3500;
/** HWEvent.eventKeyAction for a key press (1 is the release). */
const KEY_DOWN = 0;

type Screen = 'home' | 'player' | 'search' | 'phone';

interface Playing {
  channel: Channel;
  /** The list ▲/▼ zaps through */
  list: Channel[];
  url: string | null;
  message: string;
}

export const App = () => {
  const [view, setView] = useState<Screen>('home');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favChannels, setFavChannels] = useState<Channel[]>([]);
  const [live, setLive] = useState<Channel[] | null>([]);
  const [searchRow, setSearchRow] = useState<Row | null>(null);
  const [status, setStatus] = useState('Cargando…');
  const [focus, setFocus] = useState<Focus>({row: 0, col: 0});
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [osd, setOsd] = useState(false);
  const [toast, setToast] = useState('');
  const [topic, setTopic] = useState('');

  const rows = homeRows(favChannels, live, searchRow);
  const sizes = rows.map((r) => r.items.length);

  // Latest values for callbacks registered once (remote, phone, timers)
  const latest = useRef({view, favorites, rows, focus, playing});
  latest.current = {view, favorites, rows, focus, playing};

  usePreventHideSplashScreen();
  const hideSplashScreen = useHideSplashScreenCallback();

  // ---------- feedback ----------

  const toastTimer = useRef(0);
  const showToast = useCallback((text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), TOAST_MS);
  }, []);

  const osdTimer = useRef(0);
  const showOsd = useCallback(() => {
    setOsd(true);
    clearTimeout(osdTimer.current);
    osdTimer.current = setTimeout(() => setOsd(false), OSD_MS);
  }, []);

  // ---------- home ----------

  const refresh = useCallback(async (slugs?: string[]) => {
    setStatus('Actualizando…');
    const [favs, liveList] = await Promise.all([
      Promise.all((slugs ?? latest.current.favorites).map(tryGetChannel)).then(
        (l) =>
          l.filter((c): c is Channel => c !== null).sort(byLiveThenViewers),
      ),
      getLiveStreams().catch(() => null),
    ]);
    setFavChannels(favs);
    setLive(liveList);
    setStatus('Actualizado ' + formatTime(new Date()));
  }, []);

  const runSearch = useCallback(async (query: string) => {
    setView('home');
    if (!query.trim()) {
      return;
    }
    setStatus(`Buscando "${query}"…`);
    try {
      const results = await searchChannels(query);
      setSearchRow({
        id: 'search',
        title: `Resultados de "${query}"`,
        items: results,
        empty: 'Sin resultados.',
      });
      setFocus({row: results.length ? 1 : 0, col: 0});
      setStatus('');
    } catch {
      setStatus('No se pudo buscar.');
    }
  }, []);

  // ---------- player ----------

  const play = useCallback(
    (channel: Channel, list: Channel[] = [channel]) => {
      setView('player');
      setPlaying({channel, list, url: null, message: 'Cargando…'});
      showOsd();
      // Fetch again: the playlist token in cached data may have expired
      getChannel(channel.slug)
        .then((fresh) => {
          setPlaying((p) => {
            if (p?.channel.slug !== channel.slug) {
              return p; // the user zapped away meanwhile
            }
            const newList = list.map((c) =>
              c.slug === fresh.slug ? fresh : c,
            );
            return fresh.live && fresh.playback
              ? {
                  channel: fresh,
                  list: newList,
                  url: fresh.playback,
                  message: 'Cargando…',
                }
              : {
                  channel: fresh,
                  list: newList,
                  url: null,
                  message: `${fresh.name} no está en vivo.`,
                };
          });
          showOsd();
        })
        .catch(() =>
          setPlaying((p) =>
            p?.channel.slug === channel.slug
              ? {...p, message: 'No se pudo abrir el canal.'}
              : p,
          ),
        );
    },
    [showOsd],
  );

  const onPlayerEvent = useCallback((e: PlayerEvent) => {
    setPlaying((p) => {
      if (!p) {
        return p;
      }
      switch (e.type) {
        case 'playing':
          return {...p, message: ''};
        case 'waiting':
          return {...p, message: 'Cargando…'};
        case 'error':
          return {...p, message: `No se pudo reproducir (${e.message})`};
        default:
          return p;
      }
    });
  }, []);

  const closePlayer = useCallback(() => {
    setPlaying(null);
    setOsd(false);
    setView('home');
    refresh();
  }, [refresh]);

  const toggleFavorite = useCallback(() => {
    const p = latest.current.playing;
    if (!p) {
      return;
    }
    const next = toggled(latest.current.favorites, p.channel.slug);
    const added = next.includes(p.channel.slug);
    setFavorites(next);
    saveFavorites(next);
    showToast(added ? 'Agregado a Mis canales ★' : 'Quitado de Mis canales');
    showOsd();
  }, [showOsd, showToast]);

  const openFromPhone = useCallback(
    (slug: string) => {
      showToast(`Abriendo ${slug} desde el celu`);
      const favs = latest.current.favorites;
      if (!favs.includes(slug)) {
        const next = [...favs, slug];
        setFavorites(next);
        saveFavorites(next);
      }
      play({slug, name: slug, live: true, title: '', viewers: 0});
    },
    [play, showToast],
  );

  // ---------- remote ----------

  const back = useCallback((): boolean => {
    const v = latest.current.view;
    if (v === 'player') {
      closePlayer();
      return true;
    }
    if (v === 'search' || v === 'phone') {
      setView('home');
      return true;
    }
    return false; // exit the app
  }, [closePlayer]);

  const onKey = useCallback(
    (evt: HWEvent) => {
      if (evt.eventKeyAction !== KEY_DOWN) {
        return;
      }
      const {view: v, rows: r, focus: f, playing: p} = latest.current;
      const key = evt.eventType;
      const ok = key === 'select' || key === 'enter';
      if (v === 'search' || v === 'phone') {
        return; // the keyboard handles keys; Back comes through BackHandler
      }
      if (v === 'player') {
        if (key === 'up' || key === 'down') {
          const next =
            p && zapTarget(p.list, p.channel.slug, key === 'up' ? -1 : 1);
          if (next && p) {
            play(next, p.list);
          } else {
            showToast('No hay otro canal en vivo en esta lista');
          }
        } else if (ok) {
          toggleFavorite();
        } else {
          showOsd();
        }
        return;
      }
      const s = r.map((row) => row.items.length);
      if (key === 'up') {
        setFocus(move(f, s, -1, 0));
      } else if (key === 'down') {
        setFocus(move(f, s, 1, 0));
      } else if (key === 'left') {
        setFocus(move(f, s, 0, -1));
      } else if (key === 'right') {
        setFocus(move(f, s, 0, 1));
      } else if (ok) {
        const row = r[f.row];
        const item = row?.items[f.col];
        if (!item) {
          return;
        }
        if (isAction(item)) {
          setView(item.action);
        } else {
          play(
            item,
            row.items.filter((i): i is Channel => !isAction(i)),
          );
        }
      }
    },
    [play, showOsd, showToast, toggleFavorite],
  );

  useTVEventHandler(onKey);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  // ---------- startup ----------

  useEffect(() => {
    let stopListening = () => {};
    let cancelled = false;
    (async () => {
      const [favs, t] = await Promise.all([loadFavorites(), phoneTopic()]);
      if (cancelled) {
        return;
      }
      setFavorites(favs);
      setTopic(t);
      hideSplashScreen();
      refresh(favs);
      stopListening = listen(t, openFromPhone, (text) =>
        showToast(`No entendí "${text}"`),
      );
    })();
    const timer = setInterval(() => {
      if (latest.current.view === 'home') {
        refresh();
      }
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(toastTimer.current);
      clearTimeout(osdTimer.current);
      stopListening();
    };
    // Runs once; the callbacks it uses read the latest state through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the focus inside the grid when rows change
  const clamped = clamp(focus, sizes);
  if (clamped.row !== focus.row || clamped.col !== focus.col) {
    setFocus(clamped);
  }

  return (
    <View style={styles.app}>
      {/* Not rendered under the player, to keep its images out of memory */}
      {view !== 'player' ? (
        <HomeScreen rows={rows} focus={clamped} status={status} />
      ) : null}
      {view === 'player' && playing ? (
        <PlayerScreen
          channel={playing.channel}
          url={playing.url}
          message={playing.message}
          osd={osd}
          favorite={favorites.includes(playing.channel.slug)}
          onEvent={onPlayerEvent}
        />
      ) : null}
      {view === 'search' ? <SearchOverlay onSubmit={runSearch} /> : null}
      {view === 'phone' && topic ? <PhoneOverlay topic={topic} /> : null}
      {toast ? <Toast text={toast} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  app: {flex: 1, backgroundColor: colors.bg},
});

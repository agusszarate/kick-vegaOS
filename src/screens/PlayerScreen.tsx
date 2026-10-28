import {KeplerVideoSurfaceView} from '@amazon-devices/react-native-w3cmedia';
import * as React from 'react';
import {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {formatViewers} from '../lib/format';
import type {Channel} from '../lib/kick';
import {StreamPlayer, type PlayerEvent} from '../player/StreamPlayer';
import {SAFE_X, colors, px} from '../ui/theme';

/** Plays one URL; remount it (key={url}) to play another. */
function Video({
  url,
  onEvent,
}: {
  url: string;
  onEvent: (e: PlayerEvent) => void;
}) {
  const player = useRef<StreamPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const p = new StreamPlayer((e) => {
      if (e.type === 'ready') {
        setReady(true);
      }
      onEventRef.current(e);
    });
    player.current = p;
    p.load(url);
    return () => {
      p.destroy();
      player.current = null;
    };
  }, [url]);

  return ready ? (
    <KeplerVideoSurfaceView
      style={StyleSheet.absoluteFill}
      onSurfaceViewCreated={(h: string) => player.current?.setSurface(h)}
      onSurfaceViewDestroyed={(h: string) => player.current?.clearSurface(h)}
    />
  ) : null;
}

export function PlayerScreen({
  channel,
  url,
  message,
  osd,
  favorite,
  onEvent,
}: {
  channel: Channel;
  /** null while the channel is being looked up, or if it isn't live */
  url: string | null;
  /** Shown in the middle of the screen ('' hides it) */
  message: string;
  osd: boolean;
  favorite: boolean;
  onEvent: (e: PlayerEvent) => void;
}) {
  return (
    <View style={styles.screen}>
      {url ? <Video key={url} url={url} onEvent={onEvent} /> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {osd ? (
        <View style={styles.osd}>
          <Text style={styles.name} numberOfLines={1}>
            {channel.name}
            {favorite ? '  ★' : ''}
          </Text>
          {channel.live && channel.title ? (
            <Text style={styles.title} numberOfLines={1}>
              {channel.title} · {formatViewers(channel.viewers)} espectadores
            </Text>
          ) : null}
          <Text style={styles.hint}>
            OK: {favorite ? 'quitar de' : 'agregar a'} Mis canales · ▲▼ cambiar
            canal · Atrás: volver
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {...StyleSheet.absoluteFillObject, backgroundColor: '#000'},
  message: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '47%',
    textAlign: 'center',
    color: '#fff',
    fontSize: px(30),
  },
  osd: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: px(SAFE_X),
    paddingTop: px(32),
    paddingBottom: px(56),
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  name: {color: '#fff', fontSize: px(40), fontWeight: '700'},
  title: {color: '#ddd', fontSize: px(24), marginTop: px(4)},
  hint: {color: colors.muted, fontSize: px(20), marginTop: px(12)},
});

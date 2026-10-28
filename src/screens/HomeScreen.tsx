import * as React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import type {Focus} from '../lib/focus';
import {formatViewers} from '../lib/format';
import {isAction, type Item, type Row} from '../lib/rows';
import {SAFE_X, STAGE_WIDTH, colors, px} from '../ui/theme';

// Layout in design units (1920x1080). Rows have fixed heights so the focused
// card can be scrolled into view without measuring anything.
const CARD_W = 320;
const ACTION_W = 260;
const GAP = 20;
const THUMB_H = 180;
const META_H = 74;
const ACTION_H = 120;
const TITLE_H = 46;
const EMPTY_H = 50;
const ROW_GAP = 28;
const BORDER = 4;
/** Rows scroll up once the focused one is this far below the first row. */
const SCROLL_FROM = 140;

function rowHeight(r: Row): number {
  const body = !r.items.length
    ? EMPTY_H
    : r.id === 'actions'
    ? ACTION_H
    : THUMB_H + META_H + 2 * BORDER;
  return (r.title ? TITLE_H : 0) + body + ROW_GAP;
}

/** Horizontal offset that keeps the focused card on screen. */
function trackOffset(row: Row, col: number): number {
  const w = row.id === 'actions' ? ACTION_W : CARD_W;
  const total = row.items.length * (w + GAP) - GAP;
  const maxX = Math.max(0, total - (STAGE_WIDTH - 2 * SAFE_X));
  return Math.min(col * (w + GAP), maxX);
}

const Card = React.memo(function Card({
  item,
  focused,
}: {
  item: Item;
  focused: boolean;
}) {
  if (isAction(item)) {
    return (
      <View style={[styles.card, styles.action, focused && styles.focused]}>
        <Text style={styles.actionLabel}>{item.label}</Text>
        <Text style={styles.actionSub}>{item.sub}</Text>
      </View>
    );
  }
  const showThumb = item.live && !!item.thumb;
  const image = showThumb ? item.thumb : item.avatar;
  return (
    <View style={[styles.card, focused && styles.focused]}>
      <View style={styles.thumb}>
        {image ? (
          <Image
            source={{uri: image}}
            style={showThumb ? styles.thumbImage : styles.avatar}
            resizeMode="cover"
          />
        ) : null}
        <Text style={[styles.badge, !item.live && styles.badgeOff]}>
          {item.live ? 'EN VIVO' : 'OFFLINE'}
        </Text>
        {item.live ? (
          <Text style={styles.viewers}>
            {formatViewers(item.viewers)} espectadores
          </Text>
        ) : null}
      </View>
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
      </View>
    </View>
  );
});

export function HomeScreen({
  rows,
  focus,
  status,
}: {
  rows: Row[];
  focus: Focus;
  status: string;
}) {
  let top = 0;
  const tops = rows.map((r) => {
    const t = top;
    top += rowHeight(r);
    return t;
  });
  const scrollY = Math.max(0, (tops[focus.row] ?? 0) - SCROLL_FROM);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.logo}>kick-vegaOS</Text>
        <Text style={styles.status}>{status}</Text>
      </View>
      <View style={styles.viewport}>
        <View style={{transform: [{translateY: -px(scrollY)}]}}>
          {rows.map((row, i) => (
            <View key={row.id} style={styles.row}>
              {row.title ? (
                <Text style={styles.rowTitle}>{row.title}</Text>
              ) : null}
              {row.items.length ? (
                <View
                  style={[
                    styles.track,
                    {
                      transform: [
                        {
                          translateX: -px(
                            i === focus.row ? trackOffset(row, focus.col) : 0,
                          ),
                        },
                      ],
                    },
                  ]}>
                  {row.items.map((item, j) => (
                    <Card
                      key={isAction(item) ? item.action : item.slug}
                      item={item}
                      focused={i === focus.row && j === focus.col}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.empty}>{row.empty}</Text>
              )}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: px(54),
  },
  header: {
    marginLeft: px(SAFE_X),
    flexDirection: 'row',
    alignItems: 'center',
    height: px(80),
    marginBottom: px(24),
  },
  logo: {
    color: colors.green,
    fontSize: px(56),
    fontWeight: '900',
    marginRight: px(24),
  },
  status: {color: colors.muted, fontSize: px(22)},
  // The rows are padded inside the viewport, not the screen, so the
  // enlarged focused card isn't clipped at the left edge
  viewport: {flex: 1, overflow: 'hidden', paddingLeft: px(SAFE_X)},
  row: {marginBottom: px(ROW_GAP)},
  rowTitle: {
    color: '#fff',
    fontSize: px(28),
    fontWeight: '600',
    height: px(TITLE_H),
  },
  track: {flexDirection: 'row'},
  empty: {
    color: colors.muted,
    fontSize: px(22),
    height: px(EMPTY_H),
    paddingTop: px(12),
  },
  card: {
    width: px(CARD_W),
    marginRight: px(GAP),
    backgroundColor: colors.card,
    borderRadius: px(12),
    overflow: 'hidden',
    borderWidth: px(BORDER),
    borderColor: 'transparent',
  },
  focused: {borderColor: colors.green, transform: [{scale: 1.05}]},
  action: {
    width: px(ACTION_W),
    height: px(ACTION_H),
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {color: '#fff', fontSize: px(26), fontWeight: '600'},
  actionSub: {color: colors.muted, fontSize: px(18), marginTop: px(6)},
  thumb: {
    height: px(THUMB_H),
    backgroundColor: '#15171a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {...StyleSheet.absoluteFillObject},
  avatar: {width: px(120), height: px(120), borderRadius: px(60)},
  badge: {
    position: 'absolute',
    top: px(10),
    left: px(10),
    backgroundColor: colors.live,
    color: '#fff',
    fontSize: px(16),
    fontWeight: '700',
    paddingHorizontal: px(8),
    paddingVertical: px(2),
    borderRadius: px(4),
    overflow: 'hidden',
  },
  badgeOff: {backgroundColor: colors.offline},
  viewers: {
    position: 'absolute',
    bottom: px(8),
    left: px(10),
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#fff',
    fontSize: px(16),
    paddingHorizontal: px(8),
    paddingVertical: px(2),
    borderRadius: px(4),
    overflow: 'hidden',
  },
  meta: {height: px(META_H), paddingHorizontal: px(12), paddingTop: px(10)},
  name: {color: '#fff', fontSize: px(22), fontWeight: '700'},
  title: {color: colors.muted, fontSize: px(17), marginTop: px(2)},
});

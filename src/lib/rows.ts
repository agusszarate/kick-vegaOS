import type {Channel} from './kick';

export interface Action {
  action: 'search' | 'phone';
  label: string;
  sub: string;
}

export type Item = Channel | Action;

export interface Row {
  id: 'actions' | 'search' | 'favs' | 'live';
  title: string;
  items: Item[];
  /** Shown instead of the cards when the row has no items. */
  empty?: string;
}

export function isAction(it: Item): it is Action {
  return 'action' in it;
}

export const ACTIONS: Action[] = [
  {action: 'search', label: '🔍 Buscar', sub: 'canal por nombre'},
  {action: 'phone', label: '📱 Desde el celu', sub: 'escaneá el QR'},
];

/** Home screen rows: actions, search results (if any), favorites, live. */
export function homeRows(
  favs: Channel[],
  live: Channel[] | null,
  search: Row | null,
): Row[] {
  return [
    {id: 'actions', title: '', items: ACTIONS},
    ...(search ? [search] : []),
    {
      id: 'favs',
      title: 'Mis canales',
      items: favs,
      empty:
        'Todavía no tenés canales. Abrí un stream y apretá OK para agregarlo.',
    },
    {
      id: 'live',
      title: 'En vivo ahora en español',
      items: live ?? [],
      empty: live ? 'No hay streams en vivo.' : 'No se pudo cargar la lista.',
    },
  ];
}

/** ▲/▼ while watching: the previous/next live channel of the same list. */
export function zapTarget(
  list: Channel[],
  current: string,
  dir: 1 | -1,
): Channel | null {
  const live = list.filter((c) => c.live);
  if (live.length < 2) {
    return null;
  }
  const i = live.findIndex((c) => c.slug === current);
  if (i < 0) {
    return dir === 1 ? live[0] : live[live.length - 1];
  }
  return live[(i + dir + live.length) % live.length];
}

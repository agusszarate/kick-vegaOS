import type {Focus} from './focus';
import type {Channel} from './kick';
import {escapeHtml, formatViewers} from './util';

/** Layout is designed for 1920x1080 and scaled to the real screen (see main.ts). */
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;
/** Horizontal safe area: many TVs crop ~5% of each edge (overscan). */
export const SAFE_X = 96;

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

function cardHtml(it: Item): string {
  if (isAction(it)) {
    return `<div class="card action">${it.label}<small>${it.sub}</small></div>`;
  }
  const image = it.live && it.thumb ? it.thumb : it.avatar || '';
  const thumbClass = it.live && it.thumb ? 'thumb' : 'thumb avatar';
  const badge = it.live
    ? '<span class="badge">EN VIVO</span>'
    : '<span class="badge off">OFFLINE</span>';
  const viewers = it.live
    ? `<span class="viewers">${formatViewers(it.viewers)} espectadores</span>`
    : '';
  return (
    '<div class="card">' +
    `<div class="${thumbClass}" style="background-image:url('${escapeHtml(
      image,
    )}')">${badge}${viewers}</div>` +
    `<div class="meta"><div class="name">${escapeHtml(it.name)}</div>` +
    `<div class="title">${escapeHtml(it.title)}</div></div>` +
    '</div>'
  );
}

export function renderRows(container: HTMLElement, rows: Row[]): void {
  container.innerHTML = rows
    .map((r) => {
      const title = r.title ? `<h2>${escapeHtml(r.title)}</h2>` : '';
      const body = r.items.length
        ? `<div class="track">${r.items.map(cardHtml).join('')}</div>`
        : `<div class="empty">${escapeHtml(r.empty || '')}</div>`;
      return `<div class="row">${title}${body}</div>`;
    })
    .join('');
}

/** Highlights the focused card and scrolls its row and the page to it. */
export function paintFocus(container: HTMLElement, focus: Focus): void {
  const rowEls = container.querySelectorAll<HTMLElement>('.row');
  rowEls.forEach((rowEl, i) => {
    const cards = rowEl.querySelectorAll<HTMLElement>('.card');
    cards.forEach((c, j) =>
      c.classList.toggle('focus', i === focus.row && j === focus.col),
    );
    const track = rowEl.querySelector<HTMLElement>('.track');
    const card = cards[focus.col];
    if (track && i === focus.row && card) {
      const maxX = Math.max(0, track.scrollWidth - (STAGE_WIDTH - 2 * SAFE_X));
      track.style.transform = `translateX(${-Math.min(
        card.offsetLeft,
        maxX,
      )}px)`;
    }
  });
  const focused = rowEls[focus.row];
  if (focused) {
    container.style.transform = `translateY(${-Math.max(
      0,
      focused.offsetTop - 140,
    )}px)`;
  }
}

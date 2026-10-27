import {BACK_HANDLER, type View} from '../../shared/protocol';
import {reportView} from './bridge';
import {clamp, move, type Focus} from './focus';
import {
  ACTIONS,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  isAction,
  paintFocus,
  renderRows,
  type Row,
} from './home';
import {
  byLiveThenViewers,
  getChannel,
  getLiveStreams,
  searchChannels,
  tryGetChannel,
  type Channel,
} from './kick';
import {remoteKey} from './keys';
import {listen, qrImageTag, topicUrl} from './phone';
import {Player} from './player';
import {favorites, phoneTopic} from './storage';
import {$, formatViewers, toast} from './util';

/** How often the home screen refreshes live status while visible. */
const REFRESH_MS = 90 * 1000;
const OSD_MS = 5000;

declare global {
  interface Window {
    [BACK_HANDLER]?: () => boolean;
  }
}

class App {
  private view: View = 'home';
  private rows: Row[] = [{id: 'actions', title: '', items: ACTIONS}];
  private focus: Focus = {row: 0, col: 0};
  /** Channel on screen and the list ▲/▼ zaps through. */
  private playing: {channel: Channel; list: Channel[]} | null = null;
  private osdTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly player = new Player(
    $('player'),
    (text) => ($('msg').textContent = text),
  );
  private readonly topic = phoneTopic();

  start(): void {
    this.fitScreen();
    window.addEventListener('resize', () => this.fitScreen());
    document.addEventListener('keydown', (e) => this.onKey(e));
    window[BACK_HANDLER] = () => this.back();

    this.render();
    this.setView('home');
    this.refresh();
    listen(
      this.topic,
      (slug) => this.openFromPhone(slug),
      (text) => toast(`No entendí "${text}"`),
    );
    setInterval(() => {
      if (this.view === 'home') {
        this.refresh();
      }
    }, REFRESH_MS);
  }

  /** Scales the 1920x1080 stage to the real screen size. */
  private fitScreen(): void {
    const s = Math.min(
      window.innerWidth / STAGE_WIDTH,
      window.innerHeight / STAGE_HEIGHT,
    );
    $('stage').style.transform = `scale(${s})`;
  }

  private setView(v: View): void {
    this.view = v;
    reportView(v);
  }

  // ---------- home ----------

  private async refresh(): Promise<void> {
    $('status').textContent = 'Actualizando…';
    const [favs, live] = await Promise.all([
      Promise.all(favorites.list().map(tryGetChannel)).then((l) =>
        l.filter((c): c is Channel => c !== null).sort(byLiveThenViewers),
      ),
      getLiveStreams().catch(() => [] as Channel[]),
    ]);
    const search = this.rows.find((r) => r.id === 'search');
    this.rows = [
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
        items: live,
        empty: 'No se pudo cargar la lista.',
      },
    ];
    $('status').textContent =
      'Actualizado ' +
      new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    this.render();
  }

  private rowSizes(): number[] {
    return this.rows.map((r) => r.items.length);
  }

  private render(): void {
    this.focus = clamp(this.focus, this.rowSizes());
    renderRows($('rows'), this.rows);
    paintFocus($('rows'), this.focus);
  }

  private moveFocus(dRow: number, dCol: number): void {
    this.focus = move(this.focus, this.rowSizes(), dRow, dCol);
    paintFocus($('rows'), this.focus);
  }

  private activate(): void {
    const row = this.rows[this.focus.row];
    const item = row?.items[this.focus.col];
    if (!item) {
      return;
    }
    if (isAction(item)) {
      if (item.action === 'search') {
        this.openSearch();
      } else {
        this.openPhone();
      }
      return;
    }
    this.play(
      item,
      row.items.filter((i): i is Channel => !isAction(i)),
    );
  }

  // ---------- player ----------

  private play(channel: Channel, list: Channel[] = [channel]): void {
    this.playing = {channel, list};
    this.setView('player');
    $('home').style.display = 'none';
    $('player').style.display = 'block';
    this.showOsd(channel, 'Cargando…');
    // Fetch again: the playlist token in cached data may have expired
    getChannel(channel.slug)
      .then((fresh) => {
        if (this.playing?.channel !== channel) {
          return; // the user zapped away meanwhile
        }
        this.playing.channel = fresh;
        const i = list.indexOf(channel);
        if (i >= 0) {
          list[i] = fresh;
        }
        if (!fresh.live || !fresh.playback) {
          $('msg').textContent = `${fresh.name} no está en vivo.`;
        } else {
          this.player.play(fresh.playback);
        }
        this.showOsd(fresh);
      })
      .catch(() => ($('msg').textContent = 'No se pudo abrir el canal.'));
  }

  private closePlayer(): void {
    this.player.stop();
    this.playing = null;
    $('player').style.display = 'none';
    $('home').style.display = 'block';
    this.setView('home');
    this.refresh();
  }

  /** ▲/▼ while watching: previous/next live channel of the same list. */
  private zap(dir: 1 | -1): void {
    if (!this.playing) {
      return;
    }
    const live = this.playing.list.filter((c) => c.live);
    if (live.length < 2) {
      toast('No hay otro canal en vivo en esta lista');
      return;
    }
    const i = live.findIndex((c) => c.slug === this.playing?.channel.slug);
    this.play(live[(i + dir + live.length) % live.length], this.playing.list);
  }

  private toggleFavorite(): void {
    if (!this.playing) {
      return;
    }
    const added = favorites.toggle(this.playing.channel.slug);
    toast(added ? 'Agregado a Mis canales ★' : 'Quitado de Mis canales');
    this.showOsd(this.playing.channel);
  }

  private showOsd(c: Channel, sub?: string): void {
    const fav = favorites.has(c.slug);
    $('osdName').textContent = c.name + (fav ? '  ★' : '');
    $('osdTitle').textContent =
      sub ??
      (c.live ? `${c.title} · ${formatViewers(c.viewers)} espectadores` : '');
    $('osdHint').textContent = `OK: ${
      fav ? 'quitar de' : 'agregar a'
    } Mis canales · ▲▼ cambiar canal · Atrás: volver`;
    const osd = $('osd');
    osd.style.opacity = '1';
    clearTimeout(this.osdTimer);
    this.osdTimer = setTimeout(() => (osd.style.opacity = '0'), OSD_MS);
  }

  // ---------- overlays ----------

  private openSearch(): void {
    this.setView('search');
    $('searchBox').style.display = 'flex';
    const input = $('searchInput') as HTMLInputElement;
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }

  private openPhone(): void {
    this.setView('phone');
    const url = topicUrl(this.topic);
    $('qr').innerHTML = qrImageTag(url);
    $('topicName').textContent = url;
    $('phoneBox').style.display = 'flex';
  }

  private closeOverlay(): void {
    $('searchBox').style.display = 'none';
    $('phoneBox').style.display = 'none';
    ($('searchInput') as HTMLInputElement).blur();
    this.setView('home');
  }

  private async search(query: string): Promise<void> {
    this.closeOverlay();
    if (!query.trim()) {
      return;
    }
    $('status').textContent = `Buscando "${query}"…`;
    try {
      const results = await searchChannels(query);
      this.rows = this.rows.filter((r) => r.id !== 'search');
      this.rows.splice(1, 0, {
        id: 'search',
        title: `Resultados de "${query}"`,
        items: results,
        empty: 'Sin resultados.',
      });
      this.focus = {row: results.length ? 1 : 0, col: 0};
      $('status').textContent = '';
      this.render();
    } catch {
      $('status').textContent = 'No se pudo buscar.';
    }
  }

  private openFromPhone(slug: string): void {
    toast(`Abriendo ${slug} desde el celu`);
    favorites.add(slug);
    this.closeOverlay();
    this.play({slug, name: slug, live: true, title: '', viewers: 0});
  }

  // ---------- keys ----------

  /** Returns true if Back was handled (false lets the app exit). */
  private back(): boolean {
    if (this.view === 'player') {
      this.closePlayer();
      return true;
    }
    if (this.view === 'search' || this.view === 'phone') {
      this.closeOverlay();
      return true;
    }
    return false;
  }

  private onKey(e: KeyboardEvent): void {
    const key = remoteKey(e, this.view === 'search');
    if (key === 'back') {
      if (this.back()) {
        e.preventDefault();
      }
      return;
    }
    if (this.view === 'search') {
      if (key === 'ok') {
        e.preventDefault();
        this.search(($('searchInput') as HTMLInputElement).value);
      }
      return;
    }
    if (this.view === 'phone') {
      return;
    }
    if (this.view === 'player') {
      if (key === 'up') {
        this.zap(-1);
      } else if (key === 'down') {
        this.zap(1);
      } else if (key === 'ok') {
        this.toggleFavorite();
      } else if (this.playing) {
        this.showOsd(this.playing.channel);
        return;
      }
      e.preventDefault();
      return;
    }
    switch (key) {
      case 'up':
        this.moveFocus(-1, 0);
        break;
      case 'down':
        this.moveFocus(1, 0);
        break;
      case 'left':
        this.moveFocus(0, -1);
        break;
      case 'right':
        this.moveFocus(0, 1);
        break;
      case 'ok':
        this.activate();
        break;
      default:
        return;
    }
    e.preventDefault();
  }
}

new App().start();

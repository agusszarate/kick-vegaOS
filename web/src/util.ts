export function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`missing #${id}`);
  }
  return el;
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[
        c
      ] as string),
  );
}

/** 950 -> "950", 1234 -> "1.2 mil", 47048 -> "47 mil" */
export function formatViewers(n: number): string {
  if (!n || n < 1000) {
    return String(n || 0);
  }
  return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + ' mil';
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string): void {
  const el = $('toast');
  el.textContent = text;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.style.display = 'none'), 3500);
}

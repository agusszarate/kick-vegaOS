/** 950 -> "950", 1234 -> "1.2 mil", 47048 -> "47 mil" */
export function formatViewers(n: number): string {
  if (!n || n < 1000) {
    return String(n || 0);
  }
  return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + ' mil';
}

/** "12:51 p. m." style time for the home screen's status line. */
export function formatTime(d: Date): string {
  return d.toLocaleTimeString('es-AR', {hour: '2-digit', minute: '2-digit'});
}

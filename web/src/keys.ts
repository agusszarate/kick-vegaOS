export type Key = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back';

/**
 * Translates a keydown from the TV remote. Remotes and WebViews disagree on
 * key names, so several codes map to the same action.
 *
 * @param typing true while a text field has focus, so Backspace edits text
 */
export function remoteKey(
  e: Pick<KeyboardEvent, 'key' | 'keyCode'>,
  typing = false,
): Key | null {
  const {key, keyCode} = e;
  if (
    key === 'Escape' ||
    key === 'GoBack' ||
    key === 'BrowserBack' ||
    [27, 461, 10009].includes(keyCode) ||
    (key === 'Backspace' && !typing)
  ) {
    return 'back';
  }
  if (key === 'Enter' || keyCode === 13 || keyCode === 23) {
    return 'ok';
  }
  switch (key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
  }
  return null;
}

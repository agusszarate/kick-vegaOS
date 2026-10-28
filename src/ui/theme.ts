import {Dimensions} from 'react-native';

/** Sizes are designed for a 1920x1080 screen and scaled to the real one. */
export const STAGE_WIDTH = 1920;
/** Horizontal safe area: many TVs crop ~5% of each edge (overscan). */
export const SAFE_X = 96;

const k = Dimensions.get('window').width / STAGE_WIDTH || 1;

/** Converts a size in the 1920x1080 design to device units. */
export function px(n: number): number {
  return Math.round(n * k);
}

export const colors = {
  green: '#53fc18',
  bg: '#0b0e0f',
  card: '#191b1f',
  muted: '#9aa0a6',
  live: '#e91916',
  offline: '#3a3d42',
  overlay: 'rgba(0,0,0,0.92)',
};

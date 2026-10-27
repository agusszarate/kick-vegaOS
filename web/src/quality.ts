import type {HlsConfig, Level} from 'hls.js';

/** The Fire TV Stick has 1 GB of RAM: never decode above 720p. */
export const MAX_HEIGHT = 720;

/**
 * Restart the player after this much continuous playback. The WebView's media
 * pipeline still slowly retains memory on long live streams; recycling the
 * <video> element and MediaSource releases it (costs a ~1-2 s gap).
 */
export const RECYCLE_MS = 8 * 60 * 1000;

export const HLS_CONFIG: Partial<HlsConfig> = {
  capLevelToPlayerSize: true,
  maxBufferLength: 12,
  maxMaxBufferLength: 20,
  maxBufferSize: 20 * 1000 * 1000,
  backBufferLength: 0,
  enableWorker: true,
  lowLatencyMode: false,
  // Kick (Amazon IVS) sends ID3 and DATERANGE metadata every 1-2 s. As text
  // track cues they pile up forever on a live stream and exhaust the device
  // memory in ~10 minutes, so all metadata/subtitle features are off.
  enableID3MetadataCues: false,
  enableDateRangeMetadataCues: false,
  enableEmsgMetadataCues: false,
  enableWebVTT: false,
  enableIMSC1: false,
  enableCEA708Captions: false,
  renderTextTracksNatively: false,
};

/** Index of the highest quality at or below maxHeight, or -1 for no cap. */
export function levelCap(
  levels: Pick<Level, 'height'>[],
  maxHeight = MAX_HEIGHT,
): number {
  let cap = -1;
  levels.forEach((l, i) => {
    if (l.height <= maxHeight && (cap < 0 || l.height >= levels[cap].height)) {
      cap = i;
    }
  });
  return cap;
}

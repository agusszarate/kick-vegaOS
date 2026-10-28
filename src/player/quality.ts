/** The Fire TV Stick has 1 GB of RAM: never decode above 720p. */
export const MAX_HEIGHT = 720;

/**
 * Shaka Player settings for Kick's live streams (Amazon IVS, HLS).
 *
 * The buffers are small on purpose: a live stream doesn't need much video
 * ahead, and video already played (bufferBehind) is evicted right away, so
 * memory stays flat however long a stream runs. Kick's ID3/DATERANGE
 * metadata never becomes text cues because text streaming is off.
 */
export const SHAKA_CONFIG = {
  streaming: {
    lowLatencyMode: false,
    bufferingGoal: 12,
    rebufferingGoal: 2,
    bufferBehind: 4,
    alwaysStreamText: false,
    retryParameters: {maxAttempts: 4, baseDelay: 1000, backoffFactor: 2},
  },
  manifest: {hls: {sequenceMode: false}},
  abr: {
    enabled: true,
    restrictions: {maxHeight: MAX_HEIGHT},
  },
};

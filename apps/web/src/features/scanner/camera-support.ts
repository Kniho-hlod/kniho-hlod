/** The back camera, in a resolution fine enough for the thin bars of a barcode. */
export const BARCODE_CAMERA: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

/**
 * Whether the browser can film at all — it can't outside HTTPS or without a camera API. Whether a
 * camera is actually there, and allowed, shows only once a scan starts.
 */
export function canUseCamera(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

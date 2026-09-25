const OUTPUT_TYPE = 'image/webp';
const OUTPUT_QUALITY = 0.85;

function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The image could not be encoded'))),
      OUTPUT_TYPE,
      OUTPUT_QUALITY
    );
  });
}

/**
 * The image scaled down so its longer side is at most `maxSize` pixels (never scaled up), as WebP —
 * or PNG in a browser that can't write WebP. Keeps uploads small whatever the camera produced.
 */
export async function resizeImage(image: Blob, maxSize: number): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Drawing on a canvas is not available');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await encode(canvas);
  } finally {
    bitmap.close();
  }
}

/** Bytes that arrived as base64 (e.g. a catalogue cover in JSON), as a `Blob`. */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

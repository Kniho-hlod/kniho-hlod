import { toIsbn13 } from '@kniho-hlod/domain';

/** Books carry their ISBN-13 as an EAN-13 barcode, the one with the 978/979 prefix. */
const BOOK_BARCODE_FORMAT = 'ean_13';

export interface DetectedBarcode {
  rawValue: string;
}

/** Reads the barcodes in a video frame — the part of the Barcode Detection API used here. */
export interface BarcodeReader {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

interface BarcodeReaderClass {
  new (options: { formats: string[] }): BarcodeReader;
  getSupportedFormats(): Promise<readonly string[]>;
}

async function createNativeReader(): Promise<BarcodeReader | null> {
  const Native = (globalThis as { BarcodeDetector?: BarcodeReaderClass }).BarcodeDetector;
  if (!Native) return null;
  const formats = await Native.getSupportedFormats();
  return formats.includes(BOOK_BARCODE_FORMAT)
    ? new Native({ formats: [BOOK_BARCODE_FORMAT] })
    : null;
}

/**
 * The WebAssembly reader, for browsers without a native one (iOS, desktop Chrome on Windows).
 * Loaded only when a scan starts; its `.wasm` is served with the app instead of from the
 * polyfill's default CDN.
 */
async function createWasmReader(): Promise<BarcodeReader> {
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? wasmUrl : prefix + path,
    },
  });
  return new BarcodeDetector({ formats: [BOOK_BARCODE_FORMAT] });
}

/** No barcode reader could be set up — typically the WebAssembly one failed to download. */
export class BarcodeReaderUnavailableError extends Error {
  constructor(cause: unknown) {
    super('No barcode reader is available', { cause });
    this.name = 'BarcodeReaderUnavailableError';
  }
}

let reader: Promise<BarcodeReader> | undefined;

/**
 * The browser's own reader where it knows EAN-13 (Android, macOS), else the WebAssembly one.
 * Set up once; after a failure the next scan tries again.
 */
export function getBookBarcodeReader(): Promise<BarcodeReader> {
  reader ??= createNativeReader()
    .then((native) => native ?? createWasmReader())
    .catch((err: unknown) => {
      reader = undefined;
      throw new BarcodeReaderUnavailableError(err);
    });
  return reader;
}

/** The ISBN of the first barcode that is a book's; `null` when none is (a price tag, say). */
export function findIsbn(barcodes: readonly DetectedBarcode[]): string | null {
  for (const { rawValue } of barcodes) {
    const isbn = toIsbn13(rawValue);
    if (isbn) return isbn;
  }
  return null;
}

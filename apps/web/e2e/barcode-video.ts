import { writeFileSync } from 'node:fs';

/**
 * A still video of an EAN-13 barcode in the Y4M format Chromium plays as a fake camera
 * (`--use-file-for-fake-video-capture`): black bars on white, grey chroma.
 */

/** The seven modules of each digit in the left half's odd parity; the others derive from them. */
const ODD_PARITY_CODES = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];
/** The parity of the six left digits, chosen by the first digit (which has no bars of its own). */
const LEFT_PARITIES = [
  'OOOOOO',
  'OOEOEE',
  'OOEEOE',
  'OOEEEO',
  'OEOOEE',
  'OEEOOE',
  'OEEEOO',
  'OEOEOE',
  'OEOEEO',
  'OEEOEO',
];
const START_OR_END_GUARD = '101';
const CENTRE_GUARD = '01010';

const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 480;
const MODULE_WIDTH_PX = 4;
const BAR_HEIGHT_PX = 240;
const FRAME_COUNT = 3;
const WHITE = 255;
const BLACK = 0;
const NEUTRAL_CHROMA = 128;

function invert(modules: string): string {
  return [...modules].map((module) => (module === '1' ? '0' : '1')).join('');
}

function rightCode(digit: number): string {
  return invert(ODD_PARITY_CODES[digit]);
}

function evenParityCode(digit: number): string {
  return [...rightCode(digit)].reverse().join('');
}

/** The 95 modules of an EAN-13 code, `1` for a bar. */
export function ean13Modules(code: string): string {
  const [first, ...rest] = [...code].map(Number);
  const left = rest
    .slice(0, 6)
    .map((digit, index) =>
      LEFT_PARITIES[first][index] === 'O' ? ODD_PARITY_CODES[digit] : evenParityCode(digit)
    )
    .join('');
  const right = rest.slice(6).map(rightCode).join('');
  return `${START_OR_END_GUARD}${left}${CENTRE_GUARD}${right}${START_OR_END_GUARD}`;
}

function drawLuma(modules: string): Buffer {
  const luma = Buffer.alloc(FRAME_WIDTH * FRAME_HEIGHT, WHITE);
  const left = Math.round((FRAME_WIDTH - modules.length * MODULE_WIDTH_PX) / 2);
  const top = Math.round((FRAME_HEIGHT - BAR_HEIGHT_PX) / 2);
  for (let row = top; row < top + BAR_HEIGHT_PX; row++) {
    for (let index = 0; index < modules.length; index++) {
      if (modules[index] !== '1') continue;
      const start = row * FRAME_WIDTH + left + index * MODULE_WIDTH_PX;
      luma.fill(BLACK, start, start + MODULE_WIDTH_PX);
    }
  }
  return luma;
}

/** Writes a few identical frames showing the barcode of `ean13`; Chromium loops them. */
export function writeBarcodeVideo(path: string, ean13: string): void {
  const header = `YUV4MPEG2 W${FRAME_WIDTH} H${FRAME_HEIGHT} F10:1 Ip A1:1 C420jpeg\n`;
  const chroma = Buffer.alloc((FRAME_WIDTH / 2) * (FRAME_HEIGHT / 2), NEUTRAL_CHROMA);
  const frame = Buffer.concat([
    Buffer.from('FRAME\n'),
    drawLuma(ean13Modules(ean13)),
    chroma,
    chroma,
  ]);
  writeFileSync(path, Buffer.concat([Buffer.from(header), ...Array(FRAME_COUNT).fill(frame)]));
}

/**
 * The first sheet of an Excel workbook (`.xlsx`) as rows of cell texts, read with the browser's
 * own unzipping (`DecompressionStream`) and XML parser — no spreadsheet library. Enough for the
 * plain tables apps export: shared and inline strings, numbers and booleans as written.
 */

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const END_RECORD_SIZE = 22;
const MAX_COMMENT_SIZE = 0xffff;
const STORED = 0;
const DEFLATED = 8;
const SHEET_PATH = /^xl\/worksheets\/sheet\d+\.xml$/;
const FIRST_SHEET = 'xl/worksheets/sheet1.xml';
const SHARED_STRINGS = 'xl/sharedStrings.xml';
const LETTERS_IN_ALPHABET = 26;
const CHAR_CODE_BEFORE_A = 'A'.charCodeAt(0) - 1;

interface ZipEntry {
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

export class UnreadableWorkbookError extends Error {
  constructor() {
    super('The file is not an Excel workbook this app can read');
  }
}

function readEntries(view: DataView): Map<string, ZipEntry> {
  const lowest = Math.max(0, view.byteLength - END_RECORD_SIZE - MAX_COMMENT_SIZE);
  let end = -1;
  for (let offset = view.byteLength - END_RECORD_SIZE; offset >= lowest; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new UnreadableWorkbookError();

  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_DIRECTORY_ENTRY)
      throw new UnreadableWorkbookError();
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = decoder.decode(
      new Uint8Array(view.buffer as ArrayBuffer, offset + 46, nameLength)
    );
    entries.set(name, {
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readEntry(view: DataView, entry: ZipEntry): Promise<string> {
  const header = entry.localHeaderOffset;
  if (view.getUint32(header, true) !== LOCAL_FILE_HEADER) throw new UnreadableWorkbookError();
  const start = header + 30 + view.getUint16(header + 26, true) + view.getUint16(header + 28, true);
  const bytes = new Uint8Array(view.buffer as ArrayBuffer, start, entry.compressedSize);
  if (entry.method === STORED) return new TextDecoder().decode(bytes);
  if (entry.method !== DEFLATED) throw new UnreadableWorkbookError();
  const stream = new Response(bytes).body!.pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

/** Every element with this local name, whatever namespace prefix the file uses. */
function elements(parent: Document | Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS('*', name));
}

function textOf(element: Element): string {
  return elements(element, 't')
    .map((t) => t.textContent ?? '')
    .join('');
}

/** `C7` → 2: the column of a cell reference, counted from 0. */
function columnIndex(reference: string): number {
  let index = 0;
  for (const letter of reference.replace(/\d+$/, '').toUpperCase()) {
    index = index * LETTERS_IN_ALPHABET + (letter.charCodeAt(0) - CHAR_CODE_BEFORE_A);
  }
  return index - 1;
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

export async function readXlsx(file: Blob): Promise<string[][]> {
  const view = new DataView(await file.arrayBuffer());
  const entries = readEntries(view);
  const sheetPath =
    (entries.has(FIRST_SHEET) ? FIRST_SHEET : undefined) ??
    [...entries.keys()].filter((name) => SHEET_PATH.test(name)).sort()[0];
  if (!sheetPath) throw new UnreadableWorkbookError();

  const sharedEntry = entries.get(SHARED_STRINGS);
  const shared = sharedEntry
    ? elements(parseXml(await readEntry(view, sharedEntry)), 'si').map(textOf)
    : [];
  const sheet = parseXml(await readEntry(view, entries.get(sheetPath)!));

  const rows: string[][] = [];
  for (const row of elements(sheet, 'row')) {
    const cells: string[] = [];
    elements(row, 'c').forEach((cell, position) => {
      const reference = cell.getAttribute('r');
      const index = reference ? columnIndex(reference) : position;
      const type = cell.getAttribute('t');
      const value = elements(cell, 'v')[0]?.textContent ?? '';
      let text: string;
      if (type === 's') text = shared[Number(value)] ?? '';
      else if (type === 'inlineStr') text = textOf(cell);
      else if (type === 'b') text = value === '1' ? 'TRUE' : 'FALSE';
      else text = value;
      cells[index] = text;
    });
    const filled = Array.from(cells, (text) => text ?? '');
    if (filled.some((text) => text.trim() !== '')) rows.push(filled);
  }
  return rows;
}

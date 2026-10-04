const BOM = '﻿';
const QUOTE = '"';
/** The separators a spreadsheet saves a table with: commas, or semicolons where the comma is decimal. */
const DELIMITERS = [',', ';', '\t'] as const;

/** The delimiter used most outside quotes on the first line. */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const unquoted = firstLine.replace(/"[^"]*"/g, '');
  let best: string = DELIMITERS[0];
  let bestCount = 0;
  for (const delimiter of DELIMITERS) {
    const count = unquoted.split(delimiter).length - 1;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

/**
 * A CSV file as rows of cells (RFC 4180: quoted cells may hold delimiters, line breaks and doubled
 * quotes). The delimiter is detected; blank lines are left out.
 */
export function parseCsv(input: string): string[][] {
  const text = input.startsWith(BOM) ? input.slice(BOM.length) : input;
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const endRow = () => {
    row.push(cell);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
    cell = '';
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character !== QUOTE) cell += character;
      else if (text[index + 1] === QUOTE) {
        cell += QUOTE;
        index += 1;
      } else quoted = false;
    } else if (character === QUOTE) quoted = true;
    else if (character === delimiter) {
      row.push(cell);
      cell = '';
    } else if (character === '\n') endRow();
    else if (character !== '\r') cell += character;
  }
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

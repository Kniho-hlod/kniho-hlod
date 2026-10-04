import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readXlsx, UnreadableWorkbookError } from './read-xlsx';

const SHARED_STRINGS = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <si><t>Název</t></si><si><t>Autor</t></si>
  <si><r><t>Válka </t></r><r><t>s mloky</t></r></si><si><t>Karel Čapek</t></si>
</sst>`;

const SHEET = `<?xml version="1.0" encoding="UTF-8"?>
<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <x:sheetData>
    <x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="B1" t="s"><x:v>1</x:v></x:c>
      <x:c r="D1" t="inlineStr"><x:is><x:t>Hodnocení</x:t></x:is></x:c></x:row>
    <x:row r="2"><x:c r="A2" t="s"><x:v>2</x:v></x:c><x:c r="B2" t="s"><x:v>3</x:v></x:c>
      <x:c r="D2"><x:v>80</x:v></x:c></x:row>
    <x:row r="3"></x:row>
  </x:sheetData>
</x:worksheet>`;

/** A zip archive as Excel writes one: deflated entries, a central directory, its end record. */
function zip(files: Record<string, string>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = new Uint8Array(deflateRawSync(encoder.encode(content)));
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(8, 8, true);
    local.setUint32(18, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(10, 8, true);
    entry.setUint32(20, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((size, part) => size + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const bytes = new Uint8Array(all.reduce((size, part) => size + part.length, 0));
  let position = 0;
  for (const part of all) {
    bytes.set(part, position);
    position += part.length;
  }
  return bytes;
}

describe('readXlsx', () => {
  it('reads the first sheet: shared, rich and inline strings, numbers, gaps', async () => {
    const workbook = zip({
      'xl/sharedStrings.xml': SHARED_STRINGS,
      'xl/worksheets/sheet1.xml': SHEET,
    });

    expect(await readXlsx(new Blob([workbook]))).toEqual([
      ['Název', 'Autor', '', 'Hodnocení'],
      ['Válka s mloky', 'Karel Čapek', '', '80'],
    ]);
  });

  it('refuses a file that is no workbook', async () => {
    await expect(readXlsx(new Blob(['Název,Autor']))).rejects.toBeInstanceOf(
      UnreadableWorkbookError
    );
  });
});

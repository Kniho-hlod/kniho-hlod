const FIELD_TERMINATOR = String.fromCharCode(0x1e);
const RECORD_TERMINATOR = String.fromCharCode(0x1d);
const LEADER_LENGTH = 24;
const RECORD_LENGTH_DIGITS = 5;
const FIELD_LENGTH_DIGITS = 4;
const FIELD_START_DIGITS = 5;
/** Leader positions 5–11 and 17–23 of a book record: new, language material, monograph… */
const LEADER_RECORD_TYPE = 'cam a22';
const LEADER_ENCODING = ' i 4500';

/** Field 008 of a book, with its MARC language code at positions 35–37. */
export function fixedLengthData(languageCode: string): string {
  return '180531s2007    xr'.padEnd(35) + languageCode + ' d';
}

/** A record in MARC exchange format (ISO 2709) holding the given fields, in order. */
export function buildMarcRecord(fields: Record<string, string>): string {
  let directory = '';
  let data = '';
  for (const [tag, value] of Object.entries(fields)) {
    const field = value + FIELD_TERMINATOR;
    directory +=
      tag +
      String(field.length).padStart(FIELD_LENGTH_DIGITS, '0') +
      String(data.length).padStart(FIELD_START_DIGITS, '0');
    data += field;
  }
  directory += FIELD_TERMINATOR;
  const baseAddress = LEADER_LENGTH + directory.length;
  const recordLength = baseAddress + data.length + RECORD_TERMINATOR.length;
  const leader =
    String(recordLength).padStart(RECORD_LENGTH_DIGITS, '0') +
    LEADER_RECORD_TYPE +
    String(baseAddress).padStart(RECORD_LENGTH_DIGITS, '0') +
    LEADER_ENCODING;
  return leader + directory + data + RECORD_TERMINATOR;
}

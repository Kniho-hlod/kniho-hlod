import { MARC_TO_ISO_639_1 } from './catalogue-entry';

/**
 * Reading a library record in MARC 21 exchange format (ISO 2709), as knihovny.cz hands it over in
 * `fullrecord`: a 24-character leader, a directory of 12-character entries (tag, length, start),
 * then the fields.
 */
const LEADER_LENGTH = 24;
const BASE_ADDRESS_START = 12;
const BASE_ADDRESS_END = 17;
const DIRECTORY_ENTRY_LENGTH = 12;
const TAG_LENGTH = 3;
const FIELD_LENGTH_END = 7;
const FIELD_TERMINATOR = String.fromCharCode(0x1e);
const FIXED_LENGTH_DATA_TAG = '008';
/** Where field 008 names the language of the item, e.g. `cze`. */
const LANGUAGE_START = 35;
const LANGUAGE_END = 38;

/**
 * The value of a control field (`001`–`009`), or `null`. The directory counts bytes; control
 * fields come first and hold ASCII, so bytes and characters line up up to them — data fields
 * further on, which hold accented text, would need the record as bytes.
 */
export function marcControlField(record: string, tag: string): string | null {
  const baseAddress = Number(record.slice(BASE_ADDRESS_START, BASE_ADDRESS_END));
  const directoryEnd = record.indexOf(FIELD_TERMINATOR, LEADER_LENGTH);
  if (!Number.isInteger(baseAddress) || directoryEnd < 0) return null;
  for (
    let entry = LEADER_LENGTH;
    entry + DIRECTORY_ENTRY_LENGTH <= directoryEnd;
    entry += DIRECTORY_ENTRY_LENGTH
  ) {
    if (record.slice(entry, entry + TAG_LENGTH) !== tag) continue;
    const fieldLength = Number(record.slice(entry + TAG_LENGTH, entry + FIELD_LENGTH_END));
    const fieldStart = Number(
      record.slice(entry + FIELD_LENGTH_END, entry + DIRECTORY_ENTRY_LENGTH)
    );
    const start = baseAddress + fieldStart;
    // The stored length includes the field terminator.
    return record.slice(start, start + fieldLength - 1);
  }
  return null;
}

/** The language of the item from field 008 as ISO 639-1 (`cs`), or `null` when not known. */
export function marcLanguage(record: string | undefined): string | null {
  if (!record) return null;
  const code = marcControlField(record, FIXED_LENGTH_DATA_TAG)?.slice(LANGUAGE_START, LANGUAGE_END);
  return code ? (MARC_TO_ISO_639_1[code] ?? null) : null;
}

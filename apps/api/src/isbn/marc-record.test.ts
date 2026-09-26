import { describe, expect, it } from 'vitest';
import { buildMarcRecord, fixedLengthData } from '../test-support/marc-record';
import { marcControlField, marcLanguage } from './marc-record';

describe('MARC record', () => {
  const record = buildMarcRecord({
    '001': 'SVK01-000842778',
    '008': fixedLengthData('cze'),
    '245': 'Pán prstenů. Návrat krále',
  });

  it('reads control fields through the directory', () => {
    expect(marcControlField(record, '001')).toBe('SVK01-000842778');
    expect(marcControlField(record, '008')).toBe(fixedLengthData('cze'));
    expect(marcControlField(record, '007')).toBeNull();
  });

  it('names the language of the item from field 008, in ISO 639-1', () => {
    expect(marcLanguage(record)).toBe('cs');
    expect(marcLanguage(buildMarcRecord({ '008': fixedLengthData('eng') }))).toBe('en');
  });

  it('knows no language for an unlisted code, a record without 008, or no record at all', () => {
    expect(marcLanguage(buildMarcRecord({ '008': fixedLengthData('grc') }))).toBeNull();
    expect(marcLanguage(buildMarcRecord({ '001': 'x' }))).toBeNull();
    expect(marcLanguage('not a MARC record')).toBeNull();
    expect(marcLanguage(undefined)).toBeNull();
  });
});

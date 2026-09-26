import { describe, expect, it, vi } from 'vitest';
import { buildMarcRecord, fixedLengthData } from '../test-support/marc-record';
import { findInKnihovnyCz } from './knihovny-cz';

const ISBN = '9788072037285';
const SEARCH_URL = 'https://www.knihovny.cz/api/v1/search?';

/** A `fetchJson` that hands every request the same answer. */
const answering = (answer: unknown) => vi.fn(async () => answer as never);

/** Two libraries' records of one Czech edition, each knowing part of it, as knihovny.cz lists them. */
const LIBRARY_RECORDS = {
  status: 'OK',
  resultCount: 2,
  records: [
    {
      title: 'Pán prstenů. Návrat krále /',
      primaryAuthors: ['J. R. R. Tolkien, 1892-1973'],
      publishers: ['Argo,'],
      publicationDates: ['c2007'],
      physicalDescriptions: ['476 s. : geneal. tabulky ; 22 cm'],
      isbns: ['80-7203-728-5 (váz.)'],
      rawData: { fullrecord: buildMarcRecord({ '008': fixedLengthData('cze') }) },
    },
    {
      title: 'Pán prstenů. 3. díl, Návrat krále',
      isbns: ['978-80-7203-728-5'],
      summary: ['Závěrečný díl trilogie.'],
    },
  ],
};

describe('knihovny.cz', () => {
  it('searches by ISBN and merges the libraries’ records, tidied', async () => {
    const fetchJson = answering(LIBRARY_RECORDS);

    expect(await findInKnihovnyCz(ISBN, fetchJson)).toEqual({
      title: 'Pán prstenů. Návrat krále',
      author: 'J. R. R. Tolkien',
      publisher: 'Argo',
      publishedYear: 2007,
      pageCount: 476,
      language: 'cs',
      description: 'Závěrečný díl trilogie.',
    });
    const [[url]] = fetchJson.mock.calls as unknown as [[string]];
    expect(url.startsWith(SEARCH_URL)).toBe(true);
    expect(url).toContain(`lookfor=${ISBN}`);
    expect(url).toContain('type=ISN');
    expect(url).toContain(`field${encodeURIComponent('[]')}=rawData`);
  });

  it('counts only records catalogued under the very ISBN looked up', async () => {
    const fetchJson = answering({
      status: 'OK',
      records: [{ title: 'Jiná kniha', isbns: ['978-80-7577-595-5'] }],
    });

    expect(await findInKnihovnyCz(ISBN, fetchJson)).toBeNull();
  });

  it('knows no book when no library has it', async () => {
    expect(await findInKnihovnyCz(ISBN, answering({ status: 'OK', records: [] }))).toBeNull();
    expect(await findInKnihovnyCz(ISBN, answering(null))).toBeNull();
  });

  it('fails when the catalogue reports an error', async () => {
    await expect(findInKnihovnyCz(ISBN, answering({ status: 'ERROR' }))).rejects.toThrow(
      'www.knihovny.cz answered ERROR'
    );
  });
});

import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';
import { fitImportedBook, importKeys, readLibraryTable } from './library-import';

const GOODREADS = [
  'Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies',
  '1,"Válka s mloky",Karel Čapek,"Čapek, Karel",,"=""8025712346""","=""9788025712344""",4,4.1,Argo,Paperback,256,2009,1936,2024/03/05,2024/01/02,"klasika, read","klasika (#1), read (#2)",read,"Skvělá<br/>kniha",,Půjčit Petrovi,1,1',
  '2,The Hobbit,J.R.R. Tolkien,"Tolkien, J.R.R.",,"=""""","=""""",0,4.3,,,310,,1937,,2024/02/01,to-read,to-read (#1),to-read,,,,0,0',
  '3,,Nobody,,,,,0,,,,,,,,,,,read,,,,0,0',
].join('\n');

describe('parseCsv', () => {
  it('reads quoted cells with delimiters, quotes and line breaks', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
    ]);
  });

  it('detects semicolons and drops a byte order mark and blank lines', () => {
    expect(parseCsv('﻿Název;Autor\n\nR.U.R.;Karel Čapek\n')).toEqual([
      ['Název', 'Autor'],
      ['R.U.R.', 'Karel Čapek'],
    ]);
  });
});

describe('readLibraryTable', () => {
  it('reads a Goodreads export', () => {
    const library = readLibraryTable(parseCsv(GOODREADS));

    expect(library?.format).toBe('goodreads');
    expect(library?.skippedRows).toBe(1);
    expect(library?.books).toEqual([
      {
        title: 'Válka s mloky',
        author: 'Karel Čapek',
        isbn: '9788025712344',
        publisher: 'Argo',
        publishedYear: 2009,
        pageCount: 256,
        readingStatus: 'read',
        rating: 4,
        finishedAt: '2024-03-05',
        review: 'Skvělá\nkniha',
        notes: 'Půjčit Petrovi',
        shelves: ['klasika'],
      },
      {
        title: 'The Hobbit',
        author: 'J.R.R. Tolkien',
        isbn: null,
        publisher: null,
        publishedYear: 1937,
        pageCount: 310,
        readingStatus: 'want',
        rating: null,
        finishedAt: null,
        review: null,
        notes: null,
        shelves: [],
      },
    ]);
  });

  it('reads a Czech table by its headings, accents and case aside', () => {
    const library = readLibraryTable([
      ['Č.', 'NÁZEV', 'Autor', 'Hodnocení', 'Přečteno', 'Poznámka', 'Poličky'],
      ['1', 'Krakatit', 'Karel Čapek', '80 %', '5. 3. 2024', 'od babičky', 'Čapek; Sci-fi'],
    ]);

    expect(library?.format).toBe('table');
    expect(library?.books[0]).toMatchObject({
      title: 'Krakatit',
      author: 'Karel Čapek',
      rating: 4,
      readingStatus: 'read',
      finishedAt: '2024-03-05',
      notes: 'od babičky',
      shelves: ['Čapek', 'Sci-fi'],
    });
  });

  it('gives up on a table without titles', () => {
    expect(readLibraryTable([['Autor', 'ISBN']])).toBeNull();
    expect(readLibraryTable([])).toBeNull();
  });
});

describe('fitImportedBook', () => {
  it('keeps what fits a book and drops the rest', () => {
    expect(
      fitImportedBook({
        title: '  R.U.R. ',
        isbn: 'not an isbn',
        rating: 9,
        readingStatus: 'reading',
        finishedAt: '2024-01-01',
        pageCount: -3,
        shelves: ['Drama', 'drama', 42],
      })
    ).toEqual({
      title: 'R.U.R.',
      author: null,
      isbn: null,
      publisher: null,
      publishedYear: null,
      pageCount: null,
      readingStatus: 'reading',
      rating: null,
      finishedAt: null,
      review: null,
      notes: null,
      shelves: ['Drama'],
    });
  });

  it('refuses a book without a title', () => {
    expect(fitImportedBook({ title: ' ' })).toBeNull();
    expect(fitImportedBook('Krakatit')).toBeNull();
  });
});

describe('importKeys', () => {
  it('matches by ISBN in any form, and by title and author', () => {
    expect(importKeys({ title: 'Krakatit', isbn: '80-257-1234-6' })).toContain('9788025712344');
    expect(importKeys({ title: 'Válka s mloky', author: 'Karel Čapek' })).toEqual(
      importKeys({ title: 'VALKA S MLOKY ', author: 'karel capek' })
    );
  });
});

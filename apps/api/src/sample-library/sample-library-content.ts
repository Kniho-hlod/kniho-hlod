import type { Locale, ReadingStatus, ShelfColor } from '@kniho-hlod/domain';

/** Each book's part in the demonstration; the loans below pick books by it. */
export type SampleBookKey =
  'overdue' | 'dueSoon' | 'returned' | 'reading' | 'favourite' | 'wanted' | 'holiday' | 'unread';
export type SampleShelfKey = 'favourites' | 'classics' | 'holiday';
export type SampleContactKey = 'neighbour' | 'friend';

export interface SampleShelf {
  key: SampleShelfKey;
  name: string;
  color: ShelfColor;
}

export interface SampleBook {
  key: SampleBookKey;
  title: string;
  author: string;
  publishedYear: number;
  readingStatus: ReadingStatus;
  rating?: number;
  shelves: SampleShelfKey[];
}

export interface SampleContact {
  key: SampleContactKey;
  name: string;
  note: string;
}

export interface SampleLoan {
  book: SampleBookKey;
  contact: SampleContactKey;
  lentDaysAgo: number;
  /** Negative: the due date has passed. */
  dueInDays: number;
  /** Absent while the book is still out. */
  returnedDaysAgo?: number;
}

/** What the sample library holds in one language. Books are listed newest first. */
export interface SampleLibraryContent {
  /** The books' language, as the book form stores it. */
  language: Locale;
  shelves: SampleShelf[];
  books: SampleBook[];
  contacts: SampleContact[];
}

/** One loan past its due date, one due soon, one returned — every state the app shows. */
export const SAMPLE_LOANS: SampleLoan[] = [
  { book: 'overdue', contact: 'neighbour', lentDaysAgo: 35, dueInDays: -5 },
  { book: 'dueSoon', contact: 'friend', lentDaysAgo: 26, dueInDays: 2 },
  { book: 'returned', contact: 'neighbour', lentDaysAgo: 90, dueInDays: -60, returnedDaysAgo: 62 },
];

/** Reading dates, in days before today, for the books being read and the books read. */
export const SAMPLE_READING_DAYS_AGO = { reading: 10, started: 60, finished: 45 };

export const SAMPLE_LIBRARIES: Record<Locale, SampleLibraryContent> = {
  cs: {
    language: 'cs',
    shelves: [
      { key: 'favourites', name: 'Oblíbené', color: 'red' },
      { key: 'classics', name: 'Klasika', color: 'amber' },
      { key: 'holiday', name: 'Na dovolenou', color: 'sky' },
    ],
    books: [
      {
        key: 'overdue',
        title: 'Saturnin',
        author: 'Zdeněk Jirotka',
        publishedYear: 1942,
        readingStatus: 'read',
        rating: 5,
        shelves: ['favourites'],
      },
      {
        key: 'reading',
        title: 'Krakatit',
        author: 'Karel Čapek',
        publishedYear: 1924,
        readingStatus: 'reading',
        shelves: ['classics'],
      },
      {
        key: 'dueSoon',
        title: 'Hobit aneb Cesta tam a zase zpátky',
        author: 'J. R. R. Tolkien',
        publishedYear: 1937,
        readingStatus: 'read',
        rating: 4,
        shelves: ['favourites'],
      },
      {
        key: 'favourite',
        title: 'Malý princ',
        author: 'Antoine de Saint-Exupéry',
        publishedYear: 1943,
        readingStatus: 'read',
        rating: 5,
        shelves: ['favourites', 'classics'],
      },
      {
        key: 'wanted',
        title: 'Stopařův průvodce po Galaxii',
        author: 'Douglas Adams',
        publishedYear: 1979,
        readingStatus: 'want',
        shelves: ['holiday'],
      },
      {
        key: 'returned',
        title: '1984',
        author: 'George Orwell',
        publishedYear: 1949,
        readingStatus: 'read',
        rating: 4,
        shelves: ['classics'],
      },
      {
        key: 'holiday',
        title: 'Tři muži ve člunu (o psu nemluvě)',
        author: 'Jerome Klapka Jerome',
        publishedYear: 1889,
        readingStatus: 'want',
        shelves: ['holiday'],
      },
      {
        key: 'unread',
        title: 'Babička',
        author: 'Božena Němcová',
        publishedYear: 1855,
        readingStatus: 'none',
        shelves: ['classics'],
      },
    ],
    contacts: [
      {
        key: 'neighbour',
        name: 'Petr Novák',
        note: 'Ukázkový kontakt z průvodce. Smažete ho s ostatními ukázkami v Nastavení účtu.',
      },
      {
        key: 'friend',
        name: 'Lucie Dvořáková',
        note: 'Ukázkový kontakt z průvodce. Smažete ho s ostatními ukázkami v Nastavení účtu.',
      },
    ],
  },
  en: {
    language: 'en',
    shelves: [
      { key: 'favourites', name: 'Favourites', color: 'red' },
      { key: 'classics', name: 'Classics', color: 'amber' },
      { key: 'holiday', name: 'Holiday reads', color: 'sky' },
    ],
    books: [
      {
        key: 'overdue',
        title: "The Hitchhiker's Guide to the Galaxy",
        author: 'Douglas Adams',
        publishedYear: 1979,
        readingStatus: 'read',
        rating: 5,
        shelves: ['favourites'],
      },
      {
        key: 'reading',
        title: 'War with the Newts',
        author: 'Karel Čapek',
        publishedYear: 1936,
        readingStatus: 'reading',
        shelves: ['classics'],
      },
      {
        key: 'dueSoon',
        title: 'The Hobbit',
        author: 'J. R. R. Tolkien',
        publishedYear: 1937,
        readingStatus: 'read',
        rating: 4,
        shelves: ['favourites'],
      },
      {
        key: 'favourite',
        title: 'The Little Prince',
        author: 'Antoine de Saint-Exupéry',
        publishedYear: 1943,
        readingStatus: 'read',
        rating: 5,
        shelves: ['favourites', 'classics'],
      },
      {
        key: 'wanted',
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        publishedYear: 1813,
        readingStatus: 'want',
        shelves: ['classics'],
      },
      {
        key: 'returned',
        title: 'Nineteen Eighty-Four',
        author: 'George Orwell',
        publishedYear: 1949,
        readingStatus: 'read',
        rating: 4,
        shelves: ['classics'],
      },
      {
        key: 'holiday',
        title: 'Three Men in a Boat',
        author: 'Jerome K. Jerome',
        publishedYear: 1889,
        readingStatus: 'want',
        shelves: ['holiday'],
      },
      {
        key: 'unread',
        title: 'Jane Eyre',
        author: 'Charlotte Brontë',
        publishedYear: 1847,
        readingStatus: 'none',
        shelves: ['classics'],
      },
    ],
    contacts: [
      {
        key: 'neighbour',
        name: 'Peter Smith',
        note: 'A sample contact from the tour. It goes with the other samples in Account settings.',
      },
      {
        key: 'friend',
        name: 'Lucy Brown',
        note: 'A sample contact from the tour. It goes with the other samples in Account settings.',
      },
    ],
  },
};

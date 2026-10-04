import { computed, reactive, ref } from 'vue';
import type { IsbnLookupResult } from '@kniho-hlod/domain';

/**
 * - `looking`: the catalogues and the library are being asked;
 * - `found`: a catalogue knows the book, ready to add;
 * - `unknown`: no catalogue knows it (or none answered): the reader types the title;
 * - `owned`: the reader has the book already, it is left out;
 * - `added`: it is in the library now.
 */
export type ScannedBookState = 'looking' | 'found' | 'unknown' | 'owned' | 'added';

export interface ScannedBook {
  isbn: string;
  state: ScannedBookState;
  /** The catalogue's title, or the one the reader types for an unknown book. */
  title: string;
  author: string | null;
  details: IsbnLookupResult | null;
  /** The reader's copy, for an `owned` book. */
  ownedBookId: string | null;
  /** Why the book is `unknown`, or why adding it failed. */
  problem: string | null;
}

export interface ShelfScanSources {
  lookUp(isbn: string): Promise<IsbnLookupResult>;
  findOwned(isbn: string): Promise<{ id: string; title: string } | null>;
  /** The words for a failed lookup: an unknown ISBN, the catalogues down, … */
  describeLookupError(err: unknown): string;
}

/** What a scan did: a new book in the list, or one scanned already. */
export type ScanOutcome = 'new' | 'again';

/** The books scanned one after another, newest first, each looked up as it comes. */
export function createShelfScan(sources: ShelfScanSources) {
  const books = ref<ScannedBook[]>([]);

  async function resolve(book: ScannedBook): Promise<void> {
    const [owned, found] = await Promise.allSettled([
      sources.findOwned(book.isbn),
      sources.lookUp(book.isbn),
    ]);
    if (owned.status === 'fulfilled' && owned.value) {
      book.state = 'owned';
      book.ownedBookId = owned.value.id;
      book.title = owned.value.title;
    } else if (found.status === 'fulfilled') {
      book.state = 'found';
      book.details = found.value;
      book.title = found.value.title;
      book.author = found.value.author;
    } else {
      book.state = 'unknown';
      book.problem = sources.describeLookupError(found.reason);
    }
  }

  function scan(isbn: string): ScanOutcome {
    if (books.value.some((book) => book.isbn === isbn)) return 'again';
    const book = reactive<ScannedBook>({
      isbn,
      state: 'looking',
      title: '',
      author: null,
      details: null,
      ownedBookId: null,
      problem: null,
    });
    books.value = [book, ...books.value];
    void resolve(book);
    return 'new';
  }

  function remove(isbn: string): void {
    books.value = books.value.filter((book) => book.isbn !== isbn);
  }

  /** The books that will go into the library: found, or unknown with a title typed in. */
  const toAdd = computed(() =>
    books.value.filter(
      (book) => (book.state === 'found' || book.state === 'unknown') && book.title.trim().length > 0
    )
  );
  const isLooking = computed(() => books.value.some((book) => book.state === 'looking'));

  return { books, scan, remove, toAdd, isLooking };
}

export type ShelfScan = ReturnType<typeof createShelfScan>;

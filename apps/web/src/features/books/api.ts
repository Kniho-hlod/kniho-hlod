import { computed } from 'vue';
import type { Ref } from 'vue';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/vue-query';
import { ApiError } from '@eleansphere/entity-core';
import type { PaginatedResponse } from '@eleansphere/entity-core';
import { FILE_ROLES } from '@kniho-hlod/domain';
import type { Book, BookWithDetails, ReadingStatus } from '@kniho-hlod/domain';
import { services } from '@/app/api';
import { describeError } from '@/app/errors';
import { translate } from '@/app/i18n';
import { invalidateLibrary, QUERY_KEYS } from '@/app/library-queries';
import { nextPageNumber } from '@/app/pagination';
import { base64ToBlob, resizeImage } from '@/shared/resize-image';
import { toBookPayload } from './book-form';
import type { BookFormState, CoverChange } from './book-form';

export const BOOKS_PAGE_SIZE = 24;
/** Covers are stored at most this many pixels along their longer side. */
const COVER_MAX_SIZE = 1000;
/** How many matches the book picker offers at once. */
const PICKER_LIMIT = 20;

const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const SERVICE_UNAVAILABLE = 503;

/** Whether a book is at home or out on a loan; `null` for both. */
export type Availability = 'home' | 'lent';

export interface BookListFilters {
  /** Searched in the title, author and ISBN. */
  q: string;
  readingStatus: ReadingStatus | null;
  minRating: number | null;
  availability: Availability | null;
}

export const NO_BOOK_FILTERS: BookListFilters = {
  q: '',
  readingStatus: null,
  minRating: null,
  availability: null,
};

function toListRequest(filters: BookListFilters, page: number) {
  return {
    page,
    limit: BOOKS_PAGE_SIZE,
    q: filters.q.trim() || undefined,
    filter: {
      readingStatus: filters.readingStatus ? [filters.readingStatus] : undefined,
      rating: filters.minRating ? { gte: filters.minRating } : undefined,
      lent: filters.availability === null ? undefined : filters.availability === 'lent',
    },
  };
}

/** The reader's books, newest first, a page at a time — `fetchNextPage` loads more. */
export function useBookList(filters: Ref<BookListFilters>) {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.books, 'list', filters],
    queryFn: ({ pageParam }) =>
      services.books.getAll(toListRequest(filters.value, pageParam)) as Promise<
        PaginatedResponse<BookWithDetails>
      >,
    initialPageParam: 1,
    getNextPageParam: nextPageNumber,
  });
}

/** Books at home matching what is typed into a picker — the ones that can be lent. */
export function useBooksAtHome(search: Ref<string>) {
  return useQuery({
    queryKey: [QUERY_KEYS.books, 'at-home', search],
    queryFn: () =>
      services.books.getAll({
        limit: PICKER_LIMIT,
        q: search.value.trim() || undefined,
        filter: { lent: false },
        sort: 'title',
      }),
    placeholderData: keepPreviousData,
  });
}

export function useBook(id: Ref<string | undefined>) {
  return useQuery({
    queryKey: [QUERY_KEYS.books, 'detail', id],
    queryFn: () => {
      if (!id.value) throw new Error('No book to load');
      return services.books.getById(id.value) as Promise<BookWithDetails>;
    },
    enabled: computed(() => id.value !== undefined),
  });
}

export interface SaveBookRequest {
  /** The book to update; without one a new book is created. */
  id: string | undefined;
  form: BookFormState;
  cover: CoverChange;
}

export interface SavedBook {
  book: Book;
  /** `false` when the book was saved but its new cover could not be. */
  coverSaved: boolean;
}

async function applyCoverChange(bookId: string, change: CoverChange): Promise<void> {
  const covers = services.books.files(FILE_ROLES.cover);
  if (change.kind === 'replace') {
    await covers.upload(bookId, await resizeImage(change.image, COVER_MAX_SIZE));
  } else if (change.kind === 'remove') {
    await covers.remove(change.fileId);
  }
}

/** Creates or updates a book, then its cover. A failed cover doesn't undo the saved book. */
export function useSaveBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, form, cover }: SaveBookRequest): Promise<SavedBook> => {
      const payload = toBookPayload(form);
      const book = id
        ? await services.books.update(id, payload)
        : await services.books.create(payload);
      try {
        await applyCoverChange(book.id, cover);
        return { book, coverSaved: true };
      } catch (err) {
        console.warn('The cover could not be saved', err);
        return { book, coverSaved: false };
      }
    },
    onSuccess: () => invalidateLibrary(queryClient),
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => services.books.delete(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: [QUERY_KEYS.books, 'detail', id] });
      return invalidateLibrary(queryClient);
    },
  });
}

export function useIsbnLookup() {
  return useMutation({ mutationFn: (isbn: string) => services.isbn.lookup(isbn) });
}

/** The catalogue's cover for an ISBN, as an image to import like an uploaded one. */
export async function fetchCatalogueCover(isbn: string): Promise<Blob> {
  const cover = await services.isbn.cover(isbn);
  return base64ToBlob(cover.base64, cover.mimeType);
}

/** Why a lookup found nothing, in words: unknown ISBN, catalogues down, or no ISBN at all. */
export function describeIsbnLookupError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === NOT_FOUND) return translate('books.isbnNotFound');
    if (err.status === SERVICE_UNAVAILABLE) return translate('books.isbnUnavailable');
    if (err.status === BAD_REQUEST) return translate('books.isbnInvalid');
  }
  return describeError(err);
}

import { computed } from 'vue';
import type { Ref } from 'vue';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ApiError } from '@eleansphere/entity-core';
import type { PaginatedResponse } from '@eleansphere/entity-core';
import { FILE_ROLES } from '@kniho-hlod/domain';
import type { Book, BookWithCover, ReadingStatus } from '@kniho-hlod/domain';
import { services } from '@/app/api';
import { describeError } from '@/app/errors';
import { translate } from '@/app/i18n';
import { base64ToBlob, resizeImage } from '@/shared/resize-image';
import { toBookPayload } from './book-form';
import type { BookFormState, CoverChange } from './book-form';

export const BOOKS_PAGE_SIZE = 24;
/** Covers are stored at most this many pixels along their longer side. */
const COVER_MAX_SIZE = 1000;
const BOOKS_QUERY_KEY = 'books';

const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const SERVICE_UNAVAILABLE = 503;

export interface BookListFilters {
  /** Searched in the title, author and ISBN. */
  q: string;
  readingStatus: ReadingStatus | null;
  minRating: number | null;
}

export const NO_BOOK_FILTERS: BookListFilters = { q: '', readingStatus: null, minRating: null };

function toListRequest(filters: BookListFilters, page: number) {
  return {
    page,
    limit: BOOKS_PAGE_SIZE,
    q: filters.q.trim() || undefined,
    filter: {
      readingStatus: filters.readingStatus ? [filters.readingStatus] : undefined,
      rating: filters.minRating ? { gte: filters.minRating } : undefined,
    },
  };
}

/** The reader's books, newest first, a page at a time — `fetchNextPage` loads more. */
export function useBookList(filters: Ref<BookListFilters>) {
  return useInfiniteQuery({
    queryKey: [BOOKS_QUERY_KEY, 'list', filters],
    queryFn: ({ pageParam }) =>
      services.books.getAll(toListRequest(filters.value, pageParam)) as Promise<
        PaginatedResponse<BookWithCover>
      >,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((count, page) => count + page.data.length, 0);
      return loaded < lastPage.total ? pages.length + 1 : undefined;
    },
  });
}

export function useBook(id: Ref<string | undefined>) {
  return useQuery({
    queryKey: [BOOKS_QUERY_KEY, 'detail', id],
    queryFn: () => {
      if (!id.value) throw new Error('No book to load');
      return services.books.getById(id.value) as Promise<BookWithCover>;
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY] }),
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => services.books.delete(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: [BOOKS_QUERY_KEY, 'detail', id] });
      return queryClient.invalidateQueries({ queryKey: [BOOKS_QUERY_KEY, 'list'] });
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

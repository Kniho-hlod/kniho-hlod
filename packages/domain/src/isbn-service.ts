import { ApiClient } from '@eleansphere/entity-core';
import type { IsbnCover, IsbnLookupResult } from './isbn';

const ISBN_BASE_PATH = '/api/isbn';

/** Catalogue lookups by ISBN (Open Library, then Google Books), proxied through the API. */
export class IsbnService extends ApiClient {
  /** Book details for the form. Answers 404 when no catalogue knows the ISBN. */
  lookup(isbn: string): Promise<IsbnLookupResult> {
    return this.get<IsbnLookupResult>(`${ISBN_BASE_PATH}/${encodeURIComponent(isbn)}`);
  }

  /** The catalogue's cover image, to import as the book's own cover. */
  cover(isbn: string): Promise<IsbnCover> {
    return this.get<IsbnCover>(`${ISBN_BASE_PATH}/${encodeURIComponent(isbn)}/cover`);
  }
}

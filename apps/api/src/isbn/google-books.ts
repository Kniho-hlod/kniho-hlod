import { bookFields, fitInteger, fitText, joinNames, parseYear } from '@kniho-hlod/domain';
import { trustedCoverUrl } from './catalogue-entry';
import type { CatalogueProvider } from './catalogue-entry';

const VOLUMES_URL = 'https://www.googleapis.com/books/v1/volumes';
const COVER_HOSTS = ['books.google.com', 'books.googleusercontent.com'];

interface GoogleBooksVolumeInfo {
  title?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  language?: string;
  description?: string;
  imageLinks?: { smallThumbnail?: string; thumbnail?: string };
}

function volumesUrl(isbn: string, apiKey: string | undefined): string {
  const url = new URL(VOLUMES_URL);
  url.searchParams.set('q', `isbn:${isbn}`);
  if (apiKey) url.searchParams.set('key', apiKey);
  return url.toString();
}

/**
 * Google Books. Without an API key, requests share Google's anonymous daily quota, which is
 * regularly used up (429).
 */
export const findInGoogleBooks =
  (apiKey: string | undefined): CatalogueProvider =>
  async (isbn, fetchJson) => {
    const result = await fetchJson<{ items?: { volumeInfo?: GoogleBooksVolumeInfo }[] }>(
      volumesUrl(isbn, apiKey)
    );
    const volume = result?.items?.[0]?.volumeInfo;
    const title = fitText(bookFields.title, volume?.title);
    if (!volume || !title) return null;
    return {
      details: {
        title,
        author: joinNames(volume.authors),
        publisher: fitText(bookFields.publisher, volume.publisher),
        publishedYear: parseYear(volume.publishedDate),
        pageCount: fitInteger(bookFields.pageCount, volume.pageCount),
        language: fitText(bookFields.language, volume.language),
        description: fitText(bookFields.description, volume.description),
      },
      coverUrl: trustedCoverUrl(volume.imageLinks?.thumbnail, COVER_HOSTS),
    };
  };

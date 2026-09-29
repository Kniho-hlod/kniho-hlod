import { bookFields, fitInteger, fitText, joinNames, parseYear } from '@kniho-hlod/domain';
import { trustedCoverUrl } from './catalogue-entry';
import type { CatalogueProvider } from './catalogue-entry';

const ORIGIN = 'https://www.trhknih.cz';
const COVER_HOSTS = ['www.trhknih.cz'];
const OK = 200;
const REDIRECT = 302;
const JSON_LD = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
/** The search answers with the book's page for a known ISBN, else with a page of results. */
const BOOK_PATH = /^\/kniha\/[a-z0-9]+$/;

/** An HTML page without following redirects: its status, its `Location` and its text. */
export interface Page {
  status: number;
  location: string | null;
  body: string;
}

export type FetchPage = (url: string) => Promise<Page>;

interface Named {
  name?: string;
}

/** The book as the page describes it in schema.org's terms (`application/ld+json`). */
interface SchemaBook {
  '@type'?: string;
  name?: string;
  image?: string;
  numberOfPages?: number;
  datePublished?: number | string;
  isbn?: string;
  publisher?: Named[] | Named;
  author?: Named[] | Named;
  description?: string;
}

function names(value: Named[] | Named | undefined): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.flatMap(({ name }) => (name?.trim() ? [name.trim()] : []));
}

function schemaBookOf(html: string): SchemaBook | null {
  const match = JSON_LD.exec(html);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as SchemaBook;
    return parsed['@type'] === 'Book' ? parsed : null;
  } catch {
    return null;
  }
}

function describeFailure(page: Page): Error {
  return new Error(`${new URL(ORIGIN).hostname} answered ${page.status}`);
}

/**
 * Trh knih, the Czech second-hand book market: it knows the Czech books someone has sold there
 * (about half of them, few new ones) and has their covers, photographed by the sellers. It has no
 * public API, so we read the book's public page — its schema.org data, not the layout — and only
 * for Czech and Slovak ISBNs, once per lookup (answers are cached). Unlike knihovny.cz, it lets
 * our server in.
 */
export const findInTrhKnih =
  (fetchPage: FetchPage): CatalogueProvider =>
  async (isbn) => {
    const search = await fetchPage(`${ORIGIN}/hledat?q=${encodeURIComponent(isbn)}`);
    // A known ISBN redirects to its book; a page of results (or none) means it isn't known.
    if (search.status === OK) return null;
    if (search.status !== REDIRECT || !search.location) throw describeFailure(search);
    const bookUrl = new URL(search.location, ORIGIN);
    if (bookUrl.origin !== ORIGIN || !BOOK_PATH.test(bookUrl.pathname)) return null;

    const page = await fetchPage(bookUrl.toString());
    if (page.status !== OK) throw describeFailure(page);
    const book = schemaBookOf(page.body);
    // The search is forgiving; only a book catalogued under this very ISBN counts.
    if (!book || book.isbn !== isbn) return null;
    const title = fitText(bookFields.title, book.name);
    if (!title) return null;
    return {
      details: {
        title,
        author: joinNames(names(book.author)),
        publisher: fitText(bookFields.publisher, names(book.publisher)[0]),
        publishedYear: parseYear(String(book.datePublished ?? '')),
        pageCount: fitInteger(bookFields.pageCount, book.numberOfPages),
        language: null,
        description: fitText(bookFields.description, book.description),
      },
      // The page shows the medium size; the same path serves a sharper one.
      coverUrl: trustedCoverUrl(
        book.image?.replace('/cover/medium/', '/cover/large/'),
        COVER_HOSTS
      ),
    };
  };

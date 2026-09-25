import {
  createRateLimiter,
  createVerifyToken,
  HttpError,
  ValidationError,
} from '@eleansphere/be-core';
import type { ProjectPlugin, RateLimitConfig } from '@eleansphere/be-core';
import { findIsbnIssues, toIsbn13 } from '@kniho-hlod/domain';
import type { IsbnCover, IsbnLookupResult } from '@kniho-hlod/domain';
import type { RequestHandler } from 'express';
import { asyncHandler } from '../http/async-handler';
import { CatalogueUnavailableError } from './isbn-catalogue';
import type { CatalogueEntry, IsbnCatalogue } from './isbn-catalogue';

export const ISBN_ROUTE = '/api/isbn';

const NOT_FOUND = 404;
const SERVICE_UNAVAILABLE = 503;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
/** Per reader: plenty for adding books, little for scraping the catalogues through us. */
export const ISBN_RATE_LIMIT: RateLimitConfig = { windowMs: RATE_LIMIT_WINDOW_MS, max: 120 };

export interface IsbnPluginOptions {
  catalogue: IsbnCatalogue;
  jwtSecret: string;
  rateLimit: RateLimitConfig | 'off';
}

/** The ISBN-13 in the route, or a 400 with the same issue the book form shows. */
function parseIsbn(raw: string): string {
  const isbn = toIsbn13(raw);
  if (!isbn) throw new ValidationError(findIsbnIssues({ isbn: raw }));
  return isbn;
}

async function findOrThrow(catalogue: IsbnCatalogue, isbn: string): Promise<CatalogueEntry> {
  let entry: CatalogueEntry | null;
  try {
    entry = await catalogue.find(isbn);
  } catch (err) {
    if (err instanceof CatalogueUnavailableError) {
      throw new HttpError(SERVICE_UNAVAILABLE, err.message);
    }
    throw err;
  }
  if (!entry) throw new HttpError(NOT_FOUND, 'No catalogue knows this ISBN');
  return entry;
}

/**
 * `GET /api/isbn/:isbn` — book details from the catalogues, for the book form.
 * `GET /api/isbn/:isbn/cover` — the catalogue's cover as base64 JSON, so the app can import it as
 * the book's own cover (the API never serves someone else's image host to the browser).
 * Both need a signed-in reader and are rate-limited per reader.
 */
export function createIsbnPlugin({
  catalogue,
  jwtSecret,
  rateLimit,
}: IsbnPluginOptions): ProjectPlugin {
  return {
    registerRoutes(app) {
      const guards: RequestHandler[] = [createVerifyToken(jwtSecret)];
      if (rateLimit !== 'off') {
        guards.push(createRateLimiter({ ...rateLimit, keyOf: (req) => `isbn:${req.user?.id}` }));
      }

      app.get(
        `${ISBN_ROUTE}/:isbn`,
        ...guards,
        asyncHandler(async (req, res) => {
          const isbn = parseIsbn(req.params.isbn);
          const { details, coverUrl } = await findOrThrow(catalogue, isbn);
          const result: IsbnLookupResult = { isbn, ...details, hasCover: coverUrl !== null };
          res.json(result);
        })
      );

      app.get(
        `${ISBN_ROUTE}/:isbn/cover`,
        ...guards,
        asyncHandler(async (req, res) => {
          const entry = await findOrThrow(catalogue, parseIsbn(req.params.isbn));
          const cover = await catalogue.fetchCover(entry);
          if (!cover) throw new HttpError(NOT_FOUND, 'The catalogue has no cover for this ISBN');
          const result: IsbnCover = {
            mimeType: cover.mimeType,
            base64: cover.bytes.toString('base64'),
          };
          res.json(result);
        })
      );
    },
  };
}

import type { BookDetails, FetchJson } from '@kniho-hlod/domain';

export interface CatalogueEntry {
  details: BookDetails;
  /** Where the catalogue keeps the cover; only ever an HTTPS URL on the catalogue's own host. */
  coverUrl: string | null;
}

/** Asks one catalogue about an ISBN-13: its entry, `null` when unknown; throws when unreachable. */
export type CatalogueProvider = (
  isbn: string,
  fetchJson: FetchJson
) => Promise<CatalogueEntry | null>;

/** The URL over HTTPS when it points at one of `hosts`; anything else counts as no cover. */
export function trustedCoverUrl(url: string | undefined, hosts: readonly string[]): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    parsed.protocol = 'https:';
    return hosts.includes(parsed.hostname) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

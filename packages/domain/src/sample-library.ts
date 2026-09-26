import { ApiClient } from '@eleansphere/entity-core';

/**
 * The sample library: a few books, shelves, contacts and loans the onboarding tour can put into
 * an empty library, so the reader sees the app at work. Every row it adds is marked, and the
 * reader removes them all at once.
 */
export const SAMPLE_LIBRARY_PATH = '/api/sample-library';

/**
 * Marks a book, shelf, contact or loan the sample library put in. Set by the server only; loans
 * marked with it never trigger a reminder.
 */
export const SAMPLE_FLAG_FIELD = { type: 'BOOLEAN', default: false, readOnly: true } as const;

/** `GET /api/sample-library` — what the reader can do with the sample library right now. */
export interface SampleLibraryState {
  /** The library holds rows the sample library put in, which can be removed. */
  present: boolean;
  /** The library is empty — no books, shelves or contacts — so the sample library may go in. */
  canFill: boolean;
}

export class SampleLibraryService extends ApiClient {
  state(): Promise<SampleLibraryState> {
    return this.get<SampleLibraryState>(SAMPLE_LIBRARY_PATH);
  }

  /** Puts the sample library into the reader's empty library; 409 when it isn't empty. */
  fill(): Promise<SampleLibraryState> {
    return this.post<SampleLibraryState>(SAMPLE_LIBRARY_PATH, {});
  }

  /** Removes every row the sample library put in, with the loans of its books and contacts. */
  remove(): Promise<void> {
    return this.httpDelete(SAMPLE_LIBRARY_PATH);
  }
}

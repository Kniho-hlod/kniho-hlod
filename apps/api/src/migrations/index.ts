import type { Migration } from '@eleansphere/be-core';
import { baseline } from './2026-09-26-baseline';
import { feedback } from './2026-09-26-feedback';
import { onboarding } from './2026-09-26-onboarding';
import { releaseNotes } from './2026-09-26-release-notes';
import { friends } from './2026-09-27-friends';
import { loanRequests } from './2026-09-27-loan-requests';
import { comments } from './2026-09-27-comments';

/**
 * Every change to the database schema, in the order it was made; the API applies the pending ones
 * on startup (`syncMode: 'migrate'`). A model change needs a migration here too —
 * `migrations.integration.test.ts` fails until the migrated schema matches the models again.
 */
export const migrations: Migration[] = [
  baseline,
  feedback,
  onboarding,
  releaseNotes,
  friends,
  loanRequests,
  comments,
];

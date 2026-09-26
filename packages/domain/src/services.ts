import { createServiceContainer } from '@eleansphere/entity-core';
import type { AccessTokenSource } from '@eleansphere/entity-core';
import { KnihoHlodAuthService } from './auth';
import {
  bookEntity,
  contactEntity,
  feedbackEntity,
  loanEntity,
  shelfEntity,
  systemNotificationEntity,
  userEntity,
} from './entities';
import { IsbnService } from './isbn-service';
import { SampleLibraryService } from './sample-library';
import { StatsService } from './stats';

/** Every API client the web app uses, sharing one base URL and session. */
export function createServices(baseUrl: string, tokenSource: AccessTokenSource) {
  return createServiceContainer(
    {
      auth: KnihoHlodAuthService,
      users: userEntity,
      systemNotifications: systemNotificationEntity,
      books: bookEntity,
      contacts: contactEntity,
      loans: loanEntity,
      shelves: shelfEntity,
      isbn: IsbnService,
      stats: StatsService,
      feedback: feedbackEntity,
      sampleLibrary: SampleLibraryService,
    },
    baseUrl,
    tokenSource
  );
}

export type Services = ReturnType<typeof createServices>;

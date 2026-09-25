import { createServiceContainer } from '@eleansphere/entity-core';
import type { AccessTokenSource } from '@eleansphere/entity-core';
import { KnihoHlodAuthService } from './auth';
import {
  bookEntity,
  contactEntity,
  loanEntity,
  systemNotificationEntity,
  userEntity,
} from './entities';
import { IsbnService } from './isbn-service';
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
      isbn: IsbnService,
      stats: StatsService,
    },
    baseUrl,
    tokenSource
  );
}

export type Services = ReturnType<typeof createServices>;

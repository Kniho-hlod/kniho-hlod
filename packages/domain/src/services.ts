import { createServiceContainer } from '@eleansphere/entity-core';
import type { AccessTokenSource } from '@eleansphere/entity-core';
import { KnihoHlodAuthService } from './auth';
import { bookEntity, systemNotificationEntity, userEntity } from './entities';
import { IsbnService } from './isbn-service';

/** Every API client the web app uses, sharing one base URL and session. */
export function createServices(baseUrl: string, tokenSource: AccessTokenSource) {
  return createServiceContainer(
    {
      auth: KnihoHlodAuthService,
      users: userEntity,
      systemNotifications: systemNotificationEntity,
      books: bookEntity,
      isbn: IsbnService,
    },
    baseUrl,
    tokenSource
  );
}

export type Services = ReturnType<typeof createServices>;

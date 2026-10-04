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
  wishEntity,
} from './entities';
import { CommentsService } from './comments';
import { FeedService } from './feed';
import { FriendsService } from './friends';
import { IsbnService } from './isbn-service';
import { LendingService } from './lending';
import { LibraryImportService } from './library-import/library-import';
import { NotificationsService } from './notifications';
import { RecommendationsService } from './recommendations';
import { SampleLibraryService } from './sample-library';
import { StatsService } from './stats';
import { FriendWishesService } from './wishes';

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
      friends: FriendsService,
      notifications: NotificationsService,
      lending: LendingService,
      comments: CommentsService,
      feed: FeedService,
      recommendations: RecommendationsService,
      libraryImport: LibraryImportService,
      wishes: wishEntity,
      friendWishes: FriendWishesService,
    },
    baseUrl,
    tokenSource
  );
}

export type Services = ReturnType<typeof createServices>;

import type { Friend } from '@kniho-hlod/domain';
import type { FriendLibrary } from './friend-library';
import type { FriendLink, Friendships } from './friendships';
import type { People } from './people';

/** The reader's friends as the app shows them: who, since when, sharing or not, reading what. */
export type DescribeFriends = (links: FriendLink[]) => Promise<Friend[]>;

export function createFriendDescriber(
  people: People,
  friendships: Friendships,
  friendLibrary: FriendLibrary
): DescribeFriends {
  return async (links) => {
    const friendIds = links.map(({ friendId }) => friendId);
    const [persons, sharing] = await Promise.all([
      people.summaries(friendIds),
      friendships.sharingAmong(friendIds),
    ]);
    const readingNow = await friendLibrary.readingNow([...sharing]);
    return links
      .flatMap(({ friendId, since }) => {
        const person = persons.get(friendId);
        if (!person) return [];
        const friend: Friend = {
          ...person,
          friendsSince: since.toISOString(),
          sharesLibrary: sharing.has(friendId),
          readingNow: readingNow.get(friendId) ?? [],
        };
        return [friend];
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  };
}

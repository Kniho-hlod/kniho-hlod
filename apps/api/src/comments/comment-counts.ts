import { commentEntity } from '@kniho-hlod/domain';
import type { ModelRegistry } from '../models-registry';

/** How many comments each of these books has; a book without any isn't in the map. */
export type CommentCounts = (bookIds: string[]) => Promise<Map<string, number>>;

export function createCommentCounts(registry: ModelRegistry): CommentCounts {
  return async (bookIds) => {
    if (bookIds.length === 0) return new Map();
    const counts = (await registry.get(commentEntity.config.name).count({
      where: { bookId: bookIds },
      group: ['bookId'],
    })) as unknown as { bookId: string; count: number | string }[];
    return new Map(counts.map(({ bookId, count }) => [String(bookId), Number(count)]));
  };
}

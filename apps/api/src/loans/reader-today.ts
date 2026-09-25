import { readerToday, userEntity } from '@kniho-hlod/domain';
import type { ModelRegistry } from '../models-registry';

/** Today's date (`YYYY-MM-DD`) where a reader lives. */
export type ReaderToday = (userId: string) => Promise<string>;

/** Reads the reader's time zone from their profile. `now` pins the clock in tests. */
export function createReaderToday(
  registry: ModelRegistry,
  now: () => Date = () => new Date()
): ReaderToday {
  return async (userId) => {
    const user = await registry
      .get(userEntity.config.name)
      .findByPk(userId, { attributes: ['timezone'] });
    return readerToday(user?.get('timezone'), now());
  };
}

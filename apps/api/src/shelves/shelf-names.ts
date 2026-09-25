import { Op, ValidationError } from '@eleansphere/be-core';
import type { CrudHook } from '@eleansphere/be-core';
import { shelfEntity } from '@kniho-hlod/domain';
import type { ModelRegistry } from '../models-registry';

function comparable(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/**
 * `routes.shelf.hooks`: two shelves of one reader can't share a name, whatever its letter case —
 * the shelf pickers would show them as one.
 */
export function createShelfNameCheck(registry: ModelRegistry): CrudHook {
  return async (data, req, stored) => {
    const { name } = data as { name?: unknown };
    if (typeof name !== 'string') return data;
    const otherShelves = await registry.get(shelfEntity.config.name).findAll({
      where: { ownerId: req.user?.id, ...(stored ? { id: { [Op.ne]: stored.id } } : {}) },
      attributes: ['name'],
    });
    const wanted = comparable(name);
    if (otherShelves.some((shelf) => comparable(String(shelf.get('name'))) === wanted)) {
      throw new ValidationError([{ path: 'name', code: 'unique' }]);
    }
    return data;
  };
}

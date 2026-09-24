import type { Fields } from '@eleansphere/entity-core';

/** The listed fields of an entity, e.g. the three a sign-up form asks for. */
export function pickFields<F extends Fields, K extends keyof F & string>(
  fields: F,
  names: readonly K[]
): Pick<F, K> {
  return Object.fromEntries(names.map((name) => [name, fields[name]])) as Pick<F, K>;
}

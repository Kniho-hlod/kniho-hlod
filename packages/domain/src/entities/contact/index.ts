import { defineEntity } from '@eleansphere/entity-core';
import { contactFields } from './fields';

/** The people a reader lends books to. Each belongs to the reader who added it. */
export const contactEntity = defineEntity({
  name: 'contact',
  prefix: 'ct_',
  basePath: '/api/contacts',
  access: { read: 'owner', write: 'owner' },
  fields: contactFields,
  query: {
    sort: ['name', 'createdAt'],
    defaultSort: 'name',
    search: ['name', 'email', 'phone'],
  },
});

export type Contact = InstanceType<typeof contactEntity.Dto>;

/** A contact as the API returns it: with how many books they have borrowed right now. */
export type ContactWithLoans = Contact & { activeLoans: number };

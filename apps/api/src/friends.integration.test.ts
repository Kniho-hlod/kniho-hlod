import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APP_BASE_URL, bearer, PASSWORD, startTestApp } from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

const OK = 200;
const ACCEPTED = 202;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;

const NOW = new Date('2026-09-27T10:00:00Z');
const ALL = { limit: 200 };

interface Account {
  id: string;
  email: string;
  token: string;
  displayName: string;
}

describe('Friends', () => {
  let app: TestApp;
  let registered = 0;

  const as = ({ token }: Account) => ({
    get: (path: string, query: object = {}) =>
      app.api().get(path).query(query).set('Authorization', bearer(token)),
    post: (path: string, body: object = {}) =>
      app.api().post(path).set('Authorization', bearer(token)).send(body),
    put: (path: string, body: object) =>
      app.api().put(path).set('Authorization', bearer(token)).send(body),
    patch: (path: string, body: object) =>
      app.api().patch(path).set('Authorization', bearer(token)).send(body),
    delete: (path: string, body: object = {}) =>
      app.api().delete(path).set('Authorization', bearer(token)).send(body),
  });

  const signUp = async (displayName: string, profile: object = {}): Promise<Account> => {
    registered += 1;
    const email = `friend-${registered}@kniho-hlod.test`;
    const { body } = await app
      .api()
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName });
    const account = { id: body.id ?? body.user.id, email, token: body.token, displayName };
    await as(account).patch('/api/auth/me', profile);
    return account;
  };

  /** Friends through an invite link, the quickest way. */
  const befriend = async (inviter: Account, invited: Account) => {
    const { code } = (await as(inviter).get('/api/me/invite')).body;
    expect((await as(invited).post(`/api/invites/${code}/accept`)).status).toBe(OK);
  };

  const emailsTo = (account: Account) => app.outbox.sent.filter(({ to }) => to === account.email);

  beforeAll(async () => {
    app = await startTestApp({ now: () => NOW });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('asks for a signed-in reader, but shows an invite to anyone', async () => {
    const inviter = await signUp('Zvoucí');
    const { code } = (await as(inviter).get('/api/me/invite')).body;

    expect((await app.api().get('/api/friends')).status).toBe(UNAUTHORIZED);
    expect((await app.api().post(`/api/invites/${code}/accept`)).status).toBe(UNAUTHORIZED);
    const shown = await app.api().get(`/api/invites/${code}`);
    expect(shown.status).toBe(OK);
    expect(shown.body).toEqual({
      inviter: { id: inviter.id, displayName: 'Zvoucí', avatar: null },
      relation: 'none',
    });
    expect(JSON.stringify(shown.body)).not.toContain(inviter.email);
  });

  describe('an invite link', () => {
    it('makes whoever accepts it a friend, and tells the inviter', async () => {
      const anna = await signUp('Anna');
      const boris = await signUp('Boris');
      const { code } = (await as(anna).get('/api/me/invite')).body;
      expect((await as(anna).get('/api/me/invite')).body.code).toBe(code);
      expect((await as(anna).get('/api/auth/me')).body).not.toHaveProperty('inviteCode');
      expect((await as(boris).get(`/api/invites/${code}`)).body.relation).toBe('none');

      const accepted = await as(boris).post(`/api/invites/${code}/accept`);

      expect(accepted.body).toMatchObject({
        id: anna.id,
        displayName: 'Anna',
        sharesLibrary: false,
      });
      expect((await as(anna).get('/api/friends')).body).toMatchObject([{ id: boris.id }]);
      expect((await as(boris).get('/api/friends')).body).toMatchObject([{ id: anna.id }]);
      expect((await as(boris).get(`/api/invites/${code}`)).body.relation).toBe('friends');
      expect((await as(anna).get('/api/notifications')).body).toMatchObject({
        unread: 1,
        data: [{ kind: 'friendAccepted', actor: { id: boris.id }, readAt: null }],
      });
      expect((await as(boris).post(`/api/invites/${code}/accept`)).status).toBe(OK);
      expect((await as(anna).get('/api/friends')).body).toHaveLength(1);
    });

    it('is refused to its owner and gone once replaced', async () => {
      const owner = await signUp('Vlastník odkazu');
      const other = await signUp('Někdo');
      const { code } = (await as(owner).get('/api/me/invite')).body;

      expect((await as(owner).get(`/api/invites/${code}`)).body.relation).toBe('self');
      expect((await as(owner).post(`/api/invites/${code}/accept`)).status).toBe(BAD_REQUEST);
      const replaced = (await as(owner).post('/api/me/invite')).body.code;

      expect(replaced).not.toBe(code);
      expect((await as(other).get(`/api/invites/${code}`)).status).toBe(NOT_FOUND);
      expect((await as(other).post(`/api/invites/${code}/accept`)).status).toBe(NOT_FOUND);
      expect((await as(other).get(`/api/invites/${replaced}`)).status).toBe(OK);
    });
  });

  describe('an invitation by e-mail', () => {
    it('sends a reader a friend request, in the app and by e-mail', async () => {
      const cyril = await signUp('Cyril');
      const dana = await signUp('Dana', { locale: 'en' });

      const invited = await as(cyril).post('/api/friends/invitations', {
        email: dana.email.toUpperCase(),
      });

      expect(invited.status).toBe(ACCEPTED);
      const incoming = (await as(dana).get('/api/friends/requests')).body;
      expect(incoming).toMatchObject({
        incoming: [{ person: { id: cyril.id, displayName: 'Cyril' } }],
        outgoing: [],
      });
      expect((await as(cyril).get('/api/friends/requests')).body.outgoing).toMatchObject([
        { person: { id: dana.id } },
      ]);
      expect((await as(dana).get('/api/notifications')).body.data).toMatchObject([
        { kind: 'friendRequest', actor: { id: cyril.id } },
      ]);
      const [email] = emailsTo(dana);
      expect(email?.subject).toBe('Cyril wants to be your friend — Kniho-hlod');
      expect(email?.text).toContain(`${APP_BASE_URL}/friends`);

      const accepted = await as(dana).post(
        `/api/friends/requests/${incoming.incoming[0].id}/accept`
      );

      expect(accepted.body).toMatchObject({ id: cyril.id });
      expect((await as(cyril).get('/api/friends')).body).toMatchObject([{ id: dana.id }]);
      expect((await as(cyril).get('/api/notifications')).body.data).toMatchObject([
        { kind: 'friendAccepted', actor: { id: dana.id } },
      ]);
    });

    it('invites someone without an account through the inviter’s link', async () => {
      const inviter = await signUp('Eva');
      const { code } = (await as(inviter).get('/api/me/invite')).body;

      const invited = await as(inviter).post('/api/friends/invitations', {
        email: 'newcomer@kniho-hlod.test',
      });

      expect(invited.status).toBe(ACCEPTED);
      const [email] = app.outbox.sent.filter(({ to }) => to === 'newcomer@kniho-hlod.test');
      expect(email?.subject).toBe('Eva vás zve do Kniho-hlodu');
      expect(email?.text).toContain(`${APP_BASE_URL}/invite/${code}`);
    });

    it('answers the same whoever the address belongs to', async () => {
      const inviter = await signUp('Filip');
      const reader = await signUp('Gita');
      const answers = await Promise.all(
        [reader.email, 'nobody@kniho-hlod.test', inviter.email].map((email) =>
          as(inviter).post('/api/friends/invitations', { email })
        )
      );

      expect(answers.map(({ status, body }) => ({ status, body }))).toEqual(
        Array(3).fill({ status: ACCEPTED, body: {} })
      );
      expect(emailsTo(inviter)).toEqual([]);
      expect((await as(inviter).post('/api/friends/invitations', { email: 'no' })).status).toBe(
        BAD_REQUEST
      );
    });

    it('makes two readers who asked each other friends', async () => {
      const hana = await signUp('Hana');
      const ivan = await signUp('Ivan');
      await as(hana).post('/api/friends/invitations', { email: ivan.email });

      await as(ivan).post('/api/friends/invitations', { email: hana.email });

      expect((await as(hana).get('/api/friends')).body).toMatchObject([{ id: ivan.id }]);
      expect((await as(ivan).get('/api/friends/requests')).body).toEqual({
        incoming: [],
        outgoing: [],
      });
    });

    it('keeps quiet for a reader who turned the e-mails off', async () => {
      const inviter = await signUp('Jana');
      const quiet = await signUp('Karel', { emailNotifications: false });

      await as(inviter).post('/api/friends/invitations', { email: quiet.email });

      expect(emailsTo(quiet)).toEqual([]);
      expect((await as(quiet).get('/api/notifications')).body.unread).toBe(1);
    });
  });

  it('lets the reader asked decline, and the reader who asked take it back', async () => {
    const asking = await signUp('Lída');
    const asked = await signUp('Marek');
    const stranger = await signUp('Nora');
    await as(asking).post('/api/friends/invitations', { email: asked.email });
    const requestId = (await as(asked).get('/api/friends/requests')).body.incoming[0].id;

    expect((await as(stranger).delete(`/api/friends/requests/${requestId}`)).status).toBe(
      NOT_FOUND
    );
    expect((await as(asking).post(`/api/friends/requests/${requestId}/accept`)).status).toBe(
      NOT_FOUND
    );
    expect((await as(asked).delete(`/api/friends/requests/${requestId}`)).status).toBe(NO_CONTENT);
    expect((await as(asking).get('/api/friends/requests')).body.outgoing).toEqual([]);

    await as(asking).post('/api/friends/invitations', { email: asked.email });
    const again = (await as(asking).get('/api/friends/requests')).body.outgoing[0].id;
    expect((await as(asking).delete(`/api/friends/requests/${again}`)).status).toBe(NO_CONTENT);
    expect((await as(asked).get('/api/friends/requests')).body.incoming).toEqual([]);
  });

  describe('a shared library', () => {
    let owner: Account;
    let friend: Account;
    let stranger: Account;
    const books: Record<string, string> = {};

    beforeAll(async () => {
      owner = await signUp('Olga');
      friend = await signUp('Pavel');
      stranger = await signUp('Radek');
      await befriend(owner, friend);
      const add = async (key: string, book: object) => {
        books[key] = (await as(owner).post('/api/books', book)).body.id;
      };
      await add('reading', { title: 'Krakatit', author: 'Karel Čapek', readingStatus: 'reading' });
      await add('lent', { title: 'Saturnin', notes: 'Moje soukromá poznámka', rating: 5 });
      await add('hidden', { title: 'Deník', visibility: 'private' });
      const shelf = (await as(owner).post('/api/shelves', { name: 'Klasika', color: 'amber' }))
        .body;
      const emptyShelf = await as(owner).post('/api/shelves', { name: 'Prázdná' });
      expect(emptyShelf.status).toBe(201);
      await as(owner).put(`/api/books/${books.reading}/shelves`, { shelfIds: [shelf.id] });
      await as(owner).put(`/api/books/${books.hidden}/shelves`, { shelfIds: [shelf.id] });
      const contact = (await as(owner).post('/api/contacts', { name: 'Tajný Vypůjčovatel' })).body;
      await as(owner).post('/api/loans', {
        bookId: books.lent,
        contactId: contact.id,
        lentAt: '2026-09-20',
        dueAt: '2026-10-12',
      });
    });

    it('stays closed until the owner shares it', async () => {
      expect((await as(friend).get(`/api/friends/${owner.id}/books`)).status).toBe(NOT_FOUND);
      expect((await as(friend).get(`/api/friends/${owner.id}`)).body).toMatchObject({
        sharesLibrary: false,
        readingNow: [],
      });

      await as(owner).patch('/api/auth/me', { shareLibrary: true });

      expect((await as(friend).get(`/api/friends/${owner.id}/books`)).status).toBe(OK);
    });

    it('shows friends the books not hidden from them, without anything private', async () => {
      const list = (await as(friend).get(`/api/friends/${owner.id}/books`, ALL)).body;

      expect(list.total).toBe(2);
      expect(list.data.map(({ title }: { title: string }) => title).sort()).toEqual([
        'Krakatit',
        'Saturnin',
      ]);
      const saturnin = list.data.find(({ id }: { id: string }) => id === books.lent);
      expect(saturnin).toMatchObject({ rating: 5, lent: { dueAt: '2026-10-12' }, shelves: [] });
      expect(saturnin).not.toHaveProperty('notes');
      expect(JSON.stringify(list)).not.toContain('Tajný Vypůjčovatel');
      expect(JSON.stringify(list)).not.toContain('Moje soukromá poznámka');
      expect((await as(friend).get(`/api/friends/${owner.id}/books/${books.hidden}`)).status).toBe(
        NOT_FOUND
      );
      expect(
        (await as(friend).get(`/api/friends/${owner.id}/books/${books.reading}`)).body
      ).toMatchObject({ title: 'Krakatit', lent: null, shelves: [{ name: 'Klasika' }] });
    });

    it('filters, searches and lists only shelves with shared books', async () => {
      const shelves = (await as(friend).get(`/api/friends/${owner.id}/shelves`)).body;
      expect(shelves).toMatchObject([{ name: 'Klasika', bookCount: 1 }]);

      const onShelf = await as(friend).get(`/api/friends/${owner.id}/books`, {
        shelf: shelves[0].id,
      });
      const reading = await as(friend).get(`/api/friends/${owner.id}/books`, {
        readingStatus: 'reading',
      });
      const found = await as(friend).get(`/api/friends/${owner.id}/books`, { q: 'satur' });
      const unknownFilter = await as(friend).get(`/api/friends/${owner.id}/books`, {
        notes: 'x',
      });

      expect(onShelf.body.data).toMatchObject([{ id: books.reading }]);
      expect(reading.body.data).toMatchObject([{ id: books.reading }]);
      expect(found.body.data).toMatchObject([{ id: books.lent }]);
      expect(unknownFilter.status).toBe(BAD_REQUEST);
    });

    it('tells friends what the owner is reading', async () => {
      expect((await as(friend).get('/api/friends')).body).toMatchObject([
        { id: owner.id, sharesLibrary: true, readingNow: [{ title: 'Krakatit' }] },
      ]);
    });

    it('is nobody else’s business', async () => {
      expect((await as(stranger).get(`/api/friends/${owner.id}`)).status).toBe(NOT_FOUND);
      expect((await as(stranger).get(`/api/friends/${owner.id}/books`)).status).toBe(NOT_FOUND);
      expect(
        (await as(stranger).get(`/api/friends/${owner.id}/books/${books.reading}`)).status
      ).toBe(NOT_FOUND);
      expect((await as(stranger).get(`/api/friends/${owner.id}/shelves`)).status).toBe(NOT_FOUND);
      expect((await as(friend).get(`/api/books/${books.reading}`)).status).toBe(NOT_FOUND);
    });

    it('closes when the friendship ends, for both', async () => {
      expect((await as(friend).delete(`/api/friends/${owner.id}`)).status).toBe(NO_CONTENT);

      expect((await as(friend).get(`/api/friends/${owner.id}/books`)).status).toBe(NOT_FOUND);
      expect((await as(owner).get('/api/friends')).body).toEqual([]);
      expect((await as(owner).delete(`/api/friends/${friend.id}`)).status).toBe(NOT_FOUND);
    });
  });

  describe('notifications', () => {
    it('are marked read one by one or all at once, only by their reader', async () => {
      const reader = await signUp('Silvie');
      const others = [await signUp('Tomáš'), await signUp('Uršula')];
      for (const other of others) {
        await as(other).post('/api/friends/invitations', { email: reader.email });
      }
      const feed = (await as(reader).get('/api/notifications')).body;
      expect(feed.unread).toBe(2);

      await as(others[0]!).post('/api/notifications/read', { ids: [feed.data[0].id] });
      expect((await as(reader).get('/api/notifications')).body.unread).toBe(2);
      await as(reader).post('/api/notifications/read', { ids: [feed.data[0].id] });
      expect((await as(reader).get('/api/notifications')).body.unread).toBe(1);
      await as(reader).post('/api/notifications/read');
      expect((await as(reader).get('/api/notifications')).body).toMatchObject({
        unread: 0,
        data: [{ readAt: expect.any(String) }, { readAt: expect.any(String) }],
      });
      expect((await as(reader).post('/api/notifications/read', { ids: 'x' })).status).toBe(
        BAD_REQUEST
      );
    });
  });

  it('forgets a deleted account’s friendships and notifications', async () => {
    const leaving = await signUp('Věra');
    const staying = await signUp('Zdeněk');
    await befriend(staying, leaving);
    await as(staying).post('/api/friends/invitations', { email: leaving.email });

    await as(leaving).delete('/api/auth/me', { password: PASSWORD });

    expect((await as(staying).get('/api/friends')).body).toEqual([]);
    expect((await as(staying).get('/api/notifications')).body.data).toEqual([]);
  });
});

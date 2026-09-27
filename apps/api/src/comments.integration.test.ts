import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, PASSWORD, startTestApp } from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const TEXT_MAX_LENGTH = 2000;

interface Account {
  id: string;
  token: string;
}

describe('Comments', () => {
  let app: TestApp;
  let registered = 0;
  let owner: Account;
  let friend: Account;
  let otherFriend: Account;
  let stranger: Account;
  let bookId: string;

  const as = ({ token }: Account) => ({
    get: (path: string) => app.api().get(path).set('Authorization', bearer(token)),
    post: (path: string, body: object = {}) =>
      app.api().post(path).set('Authorization', bearer(token)).send(body),
    patch: (path: string, body: object) =>
      app.api().patch(path).set('Authorization', bearer(token)).send(body),
    delete: (path: string) => app.api().delete(path).set('Authorization', bearer(token)),
  });

  const signUp = async (displayName: string, profile: object = {}): Promise<Account> => {
    registered += 1;
    const { body } = await app
      .api()
      .post('/api/auth/register')
      .send({ email: `commenter-${registered}@kniho-hlod.test`, password: PASSWORD, displayName });
    const account = { id: body.user.id, token: body.token };
    await as(account).patch('/api/auth/me', profile);
    return account;
  };

  const befriend = async (inviter: Account, invited: Account) => {
    const { code } = (await as(inviter).get('/api/me/invite')).body;
    await as(invited).post(`/api/invites/${code}/accept`);
  };

  const comment = (who: Account, book: string, text: string) =>
    as(who).post(`/api/books/${book}/comments`, { text });

  beforeAll(async () => {
    app = await startTestApp();
    owner = await signUp('Olga', { shareLibrary: true });
    friend = await signUp('Pavel');
    otherFriend = await signUp('Cyril');
    stranger = await signUp('Radek');
    await befriend(owner, friend);
    await befriend(owner, otherFriend);
    bookId = (await as(owner).post('/api/books', { title: 'Saturnin' })).body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('lets friends and the owner talk under a shared book, oldest first', async () => {
    const first = await comment(friend, bookId, '  Tahle je skvělá!  ');
    const second = await comment(owner, bookId, 'Že jo? Půjčím ti ji.');

    expect(first.status).toBe(CREATED);
    expect(first.body).toMatchObject({
      text: 'Tahle je skvělá!',
      author: { id: friend.id, displayName: 'Pavel' },
      editedAt: null,
      canEdit: true,
      canDelete: true,
    });
    expect(second.status).toBe(CREATED);
    const seenByOther = (await as(otherFriend).get(`/api/books/${bookId}/comments`)).body;
    expect(seenByOther).toMatchObject([
      { id: first.body.id, canEdit: false, canDelete: false },
      { id: second.body.id, canEdit: false, canDelete: false },
    ]);
    const seenByOwner = (await as(owner).get(`/api/books/${bookId}/comments`)).body;
    expect(seenByOwner.map(({ canDelete }: { canDelete: boolean }) => canDelete)).toEqual([
      true,
      true,
    ]);
  });

  it('rings the owner’s bell for a friend’s comment, not for their own', async () => {
    const before = (await as(owner).get('/api/notifications')).body.data.length;
    await comment(otherFriend, bookId, 'Taky chci!');
    await comment(owner, bookId, 'Dostaneš ji po Pavlovi.');

    const feed = (await as(owner).get('/api/notifications')).body;
    expect(feed.data).toHaveLength(before + 1);
    expect(feed.data[0]).toMatchObject({
      kind: 'comment',
      actor: { id: otherFriend.id },
      book: { id: bookId, title: 'Saturnin' },
    });
  });

  it('keeps the comments for those who see the book', async () => {
    const hidden = (await as(owner).post('/api/books', { title: 'Deník', visibility: 'private' }))
      .body.id;

    expect((await app.api().get(`/api/books/${bookId}/comments`)).status).toBe(UNAUTHORIZED);
    expect((await as(stranger).get(`/api/books/${bookId}/comments`)).status).toBe(NOT_FOUND);
    expect((await comment(stranger, bookId, 'Ahoj')).status).toBe(NOT_FOUND);
    expect((await as(friend).get(`/api/books/${hidden}/comments`)).status).toBe(NOT_FOUND);
    expect((await as(owner).get(`/api/books/${hidden}/comments`)).status).toBe(OK);
    expect((await as(owner).get('/api/books/bk_nothing/comments')).status).toBe(NOT_FOUND);
  });

  it('checks the text', async () => {
    expect((await comment(friend, bookId, '   ')).status).toBe(BAD_REQUEST);
    expect((await comment(friend, bookId, 'x'.repeat(TEXT_MAX_LENGTH + 1))).status).toBe(
      BAD_REQUEST
    );
    expect((await as(friend).post(`/api/books/${bookId}/comments`, {})).status).toBe(BAD_REQUEST);
  });

  it('lets the author edit, and the author or the owner delete', async () => {
    const mine = (await comment(friend, bookId, 'Překlep')).body;

    expect((await as(otherFriend).patch(`/api/comments/${mine.id}`, { text: 'X' })).status).toBe(
      NOT_FOUND
    );
    expect((await as(owner).patch(`/api/comments/${mine.id}`, { text: 'X' })).status).toBe(
      NOT_FOUND
    );
    const edited = await as(friend).patch(`/api/comments/${mine.id}`, { text: 'Opraveno' });
    expect(edited.body).toMatchObject({ text: 'Opraveno', editedAt: expect.any(String) });

    expect((await as(otherFriend).delete(`/api/comments/${mine.id}`)).status).toBe(NOT_FOUND);
    expect((await as(owner).delete(`/api/comments/${mine.id}`)).status).toBe(NO_CONTENT);
    const again = (await comment(friend, bookId, 'Znovu')).body;
    expect((await as(friend).delete(`/api/comments/${again.id}`)).status).toBe(NO_CONTENT);
    const texts = (await as(owner).get(`/api/books/${bookId}/comments`)).body.map(
      ({ text }: { text: string }) => text
    );
    expect(texts).not.toContain('Opraveno');
    expect(texts).not.toContain('Znovu');
  });

  it('shuts an ex-friend out, and goes with the book', async () => {
    const leaving = await signUp('Věra');
    await befriend(owner, leaving);
    const book = (await as(owner).post('/api/books', { title: 'Kytice' })).body.id;
    const left = (await comment(leaving, book, 'Krásné básně')).body;

    await as(leaving).delete(`/api/friends/${owner.id}`);

    expect((await as(leaving).get(`/api/books/${book}/comments`)).status).toBe(NOT_FOUND);
    expect((await as(leaving).patch(`/api/comments/${left.id}`, { text: 'X' })).status).toBe(
      NOT_FOUND
    );
    expect((await as(owner).get(`/api/books/${book}/comments`)).body).toHaveLength(1);

    await as(owner).delete(`/api/books/${book}`);
    expect((await as(owner).delete(`/api/comments/${left.id}`)).status).toBe(NOT_FOUND);
  });
});

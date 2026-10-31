import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, PASSWORD, startTestApp } from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;

const ISBN_13 = '9788020412348';
const ISBN_HYPHENATED = '978-80-204-1234-8';

interface Account {
  id: string;
  token: string;
}

interface FriendWish {
  id: string;
  title: string;
  isbn: string | null;
  note: string | null;
  gift: 'mine' | 'someoneElse' | null;
  myCopy: { id: string } | null;
}

describe('Wish lists', () => {
  let app: TestApp;
  let registered = 0;
  let owner: Account;
  let giver: Account;
  let otherFriend: Account;
  let stranger: Account;
  let duneWish: string;

  const as = ({ token }: Account) => ({
    get: (path: string) => app.api().get(path).set('Authorization', bearer(token)),
    post: (path: string, body: object = {}) =>
      app.api().post(path).set('Authorization', bearer(token)).send(body),
    put: (path: string, body: object = {}) =>
      app.api().put(path).set('Authorization', bearer(token)).send(body),
    patch: (path: string, body: object) =>
      app.api().patch(path).set('Authorization', bearer(token)).send(body),
    delete: (path: string) => app.api().delete(path).set('Authorization', bearer(token)),
  });

  const signUp = async (displayName: string, profile: object = {}): Promise<Account> => {
    registered += 1;
    const { body } = await app
      .api()
      .post('/api/auth/register')
      .send({ email: `wishes-${registered}@kniho-hlod.test`, password: PASSWORD, displayName });
    const account = { id: body.user.id, token: body.token };
    await as(account).patch('/api/auth/me', profile);
    return account;
  };

  const befriend = async (inviter: Account, invited: Account) => {
    const { code } = (await as(inviter).get('/api/me/invite')).body;
    await as(invited).post(`/api/invites/${code}/accept`);
  };

  const wishesOf = (friend: Account) => `/api/friends/${friend.id}/wishes`;
  const giftOf = (friend: Account, wishId: string) => `${wishesOf(friend)}/${wishId}/gift`;
  const listAs = async (reader: Account, friend: Account) =>
    (await as(reader).get(wishesOf(friend))).body as FriendWish[];

  beforeAll(async () => {
    app = await startTestApp();
    owner = await signUp('Věra', { shareLibrary: true });
    giver = await signUp('Jana');
    otherFriend = await signUp('Karel');
    stranger = await signUp('Radek');
    await befriend(owner, giver);
    await befriend(owner, otherFriend);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('keeps the reader’s own list, with the ISBN stored as ISBN-13', async () => {
    const created = await as(owner).post('/api/wishes', {
      title: 'Duna',
      author: 'Frank Herbert',
      isbn: ISBN_HYPHENATED,
      note: 'Ideálně v tvrdé vazbě',
    });
    expect(created.status).toBe(CREATED);
    expect(created.body).toMatchObject({ title: 'Duna', isbn: ISBN_13, ownerId: owner.id });
    duneWish = created.body.id;
    await as(owner).post('/api/wishes', { title: 'Babička' });

    const invalid = await as(owner).post('/api/wishes', { title: 'Špatně', isbn: '123' });
    expect(invalid.status).toBe(BAD_REQUEST);

    const list = await as(owner).get('/api/wishes');
    expect(list.body.data.map((wish: { title: string }) => wish.title).sort()).toEqual([
      'Babička',
      'Duna',
    ]);
    expect((await as(giver).get(`/api/wishes/${duneWish}`)).status).toBe(NOT_FOUND);
  });

  it('shows the list to friends who see the library, with their own copy', async () => {
    await as(giver).post('/api/books', { title: 'Duna', isbn: ISBN_13 });

    const list = await listAs(giver, owner);
    expect(list.map((wish) => wish.title).sort()).toEqual(['Babička', 'Duna']);
    const dune = list.find((wish) => wish.id === duneWish);
    expect(dune).toMatchObject({ note: 'Ideálně v tvrdé vazbě', gift: null });
    expect(dune?.myCopy).not.toBeNull();

    expect((await as(stranger).get(wishesOf(owner))).status).toBe(NOT_FOUND);
    // A friend who doesn't share keeps the list to themselves.
    expect((await as(owner).get(wishesOf(giver))).status).toBe(NOT_FOUND);
  });

  it('lets one friend promise a book, keeping it from the owner', async () => {
    const promised = await as(giver).put(giftOf(owner, duneWish));
    expect(promised.status).toBe(OK);
    expect(promised.body.gift).toBe('mine');
    expect((await as(giver).put(giftOf(owner, duneWish))).status).toBe(OK);

    expect((await as(otherFriend).put(giftOf(owner, duneWish))).status).toBe(CONFLICT);
    const seenByOther = await listAs(otherFriend, owner);
    expect(seenByOther.find((wish) => wish.id === duneWish)?.gift).toBe('someoneElse');

    const ownView = await as(owner).get(`/api/wishes/${duneWish}`);
    expect(JSON.stringify(ownView.body)).not.toContain(giver.id);
    expect((await as(stranger).put(giftOf(owner, duneWish))).status).toBe(NOT_FOUND);
  });

  it('takes a promise back, and only the giver’s own', async () => {
    expect((await as(otherFriend).delete(giftOf(owner, duneWish))).status).toBe(NO_CONTENT);
    expect((await listAs(giver, owner)).find((wish) => wish.id === duneWish)?.gift).toBe('mine');

    expect((await as(giver).delete(giftOf(owner, duneWish))).status).toBe(NO_CONTENT);
    expect((await listAs(giver, owner)).find((wish) => wish.id === duneWish)?.gift).toBeNull();
  });

  it('drops promises when the friendship ends', async () => {
    await as(otherFriend).put(giftOf(owner, duneWish));
    expect((await as(otherFriend).delete(`/api/friends/${owner.id}`)).status).toBe(NO_CONTENT);
    expect((await listAs(giver, owner)).find((wish) => wish.id === duneWish)?.gift).toBeNull();
  });

  it('moves a wish the reader got into the library', async () => {
    expect((await as(giver).post(`/api/wishes/${duneWish}/fulfil`)).status).toBe(NOT_FOUND);

    const fulfilled = await as(owner).post(`/api/wishes/${duneWish}/fulfil`);
    expect(fulfilled.status).toBe(CREATED);
    expect(fulfilled.body).toMatchObject({
      title: 'Duna',
      author: 'Frank Herbert',
      isbn: ISBN_13,
      ownerId: owner.id,
      readingStatus: 'none',
    });
    expect((await as(owner).get(`/api/books/${fulfilled.body.id}`)).status).toBe(OK);
    expect((await as(owner).get(`/api/wishes/${duneWish}`)).status).toBe(NOT_FOUND);
    expect((await listAs(giver, owner)).map((wish) => wish.title)).toEqual(['Babička']);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, PASSWORD, PNG_SIGNATURE, startTestApp } from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;

const ISBN = '9788020412348';
const OTHER_ISBN = '9780306406157';

interface Account {
  id: string;
  token: string;
}

interface FeedItem {
  id: string;
  kind: string;
  on: string;
  friend: { id: string; displayName: string };
  book: { title: string; rating: number | null; review: string | null };
  commentCount: number;
}

describe('What friends read', () => {
  let app: TestApp;
  let registered = 0;
  let reader: Account;
  let friend: Account;
  let quietFriend: Account;
  let stranger: Account;

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
      .send({ email: `feed-${registered}@kniho-hlod.test`, password: PASSWORD, displayName });
    const account = { id: body.user.id, token: body.token };
    await as(account).patch('/api/auth/me', profile);
    return account;
  };

  const befriend = async (inviter: Account, invited: Account) => {
    const { code } = (await as(inviter).get('/api/me/invite')).body;
    await as(invited).post(`/api/invites/${code}/accept`);
  };

  const addBook = async (owner: Account, title: string, book: object = {}) =>
    (await as(owner).post('/api/books', { title, ...book })).body.id as string;

  const feedOf = async (who: Account, query = '') =>
    (await as(who).get(`/api/feed${query}`)).body.data as FeedItem[];

  beforeAll(async () => {
    app = await startTestApp();
    reader = await signUp('Věra');
    friend = await signUp('Jana', { shareLibrary: true });
    quietFriend = await signUp('Karel');
    stranger = await signUp('Radek', { shareLibrary: true });
    await befriend(reader, friend);
    await befriend(reader, quietFriend);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists what friends read, newest first, with ratings, reviews and comment counts', async () => {
    const finished = await addBook(friend, 'Saturnin', {
      author: 'Zdeněk Jirotka',
      readingStatus: 'read',
      startedAt: '2026-09-01',
      finishedAt: '2026-09-20',
      rating: 5,
      review: 'Laskavý humor.',
      notes: 'Půjčit mámě.',
    });
    await addBook(friend, 'Krakatit', { readingStatus: 'reading', startedAt: '2026-09-25' });
    await addBook(friend, 'Válka s mloky', { readingStatus: 'want' });
    await addBook(friend, 'Neviditelný', { readingStatus: 'none' });
    await addBook(friend, 'Deník', { readingStatus: 'reading', visibility: 'private' });
    await addBook(quietFriend, 'Not shared', { readingStatus: 'reading' });
    await addBook(stranger, 'Not a friend', { readingStatus: 'reading' });
    await as(reader).post(`/api/books/${finished}/comments`, { text: 'Taky ho mám rád.' });

    const feed = await feedOf(reader);

    expect(feed.map(({ book, kind }) => [book.title, kind])).toEqual([
      // Put on the wish list today, so it comes first.
      ['Válka s mloky', 'wantsToRead'],
      ['Krakatit', 'started'],
      ['Saturnin', 'finished'],
    ]);
    const saturnin = feed[2];
    expect(saturnin).toMatchObject({
      id: finished,
      on: '2026-09-20',
      friend: { id: friend.id, displayName: 'Jana' },
      book: { rating: 5, review: 'Laskavý humor.' },
      commentCount: 1,
    });
    expect(JSON.stringify(feed)).not.toContain('Půjčit mámě.');
    expect(feed[1].on).toBe('2026-09-25');
  });

  it('pages the feed and shows nothing without friends who share', async () => {
    const firstPage = (await as(reader).get('/api/feed?limit=2')).body;
    expect(firstPage).toMatchObject({ total: 3, page: 1, limit: 2 });
    expect(firstPage.data).toHaveLength(2);
    expect((await as(reader).get('/api/feed?limit=2&page=2')).body.data).toHaveLength(1);

    expect(await feedOf(stranger)).toEqual([]);
  });

  it('drops a book the moment it is hidden, or when sharing stops', async () => {
    const hidden = await addBook(friend, 'Soon hidden', { readingStatus: 'reading' });
    expect((await feedOf(reader)).map(({ id }) => id)).toContain(hidden);
    await as(friend).patch(`/api/books/${hidden}`, { visibility: 'private' });
    expect((await feedOf(reader)).map(({ id }) => id)).not.toContain(hidden);

    await as(friend).patch('/api/auth/me', { shareLibrary: false });
    expect(await feedOf(reader)).toEqual([]);
    await as(friend).patch('/api/auth/me', { shareLibrary: true });
  });

  it("shows friends' copies of a book by ISBN, and the reader's own copy", async () => {
    const friendsCopy = await addBook(friend, 'Babička', {
      isbn: '978-80-204-1234-8',
      readingStatus: 'read',
      rating: 4,
      review: 'Klasika.',
    });
    await addBook(friend, 'Hidden copy', { isbn: ISBN, visibility: 'private' });
    await addBook(stranger, 'Stranger copy', { isbn: ISBN, rating: 1 });

    const copies = (await as(reader).get(`/api/friend-copies?isbn=${ISBN}`)).body;
    expect(copies).toEqual([
      {
        friend: expect.objectContaining({ id: friend.id }),
        bookId: friendsCopy,
        readingStatus: 'read',
        rating: 4,
        review: 'Klasika.',
        commentCount: 0,
        lent: null,
      },
    ]);

    // Lent out, the copy says until when — the reader sees whom to ask and when.
    const contact = (await as(friend).post('/api/contacts', { name: 'Soused' })).body;
    const loan = (
      await as(friend).post('/api/loans', {
        bookId: friendsCopy,
        contactId: contact.id,
        lentAt: '2026-09-01',
        dueAt: '2026-10-01',
      })
    ).body;
    expect((await as(reader).get(`/api/friend-copies?isbn=${ISBN}`)).body).toMatchObject([
      { bookId: friendsCopy, lent: { dueAt: '2026-10-01' } },
    ]);
    await as(friend).post(`/api/loans/${loan.id}/return`);
    expect((await as(reader).get(`/api/friend-copies?isbn=${ISBN}`)).body).toMatchObject([
      { bookId: friendsCopy, lent: null },
    ]);

    expect((await as(reader).get(`/api/friend-copies?isbn=${OTHER_ISBN}`)).body).toEqual([]);
    expect((await as(reader).get('/api/friend-copies?isbn=nonsense')).body).toEqual([]);

    const before = (await as(reader).get(`/api/friends/${friend.id}/books/${friendsCopy}`)).body;
    expect(before).toMatchObject({ review: 'Klasika.', myCopy: null });
    const own = await addBook(reader, 'Babička', { isbn: ISBN });
    const after = (await as(reader).get(`/api/friends/${friend.id}/books/${friendsCopy}`)).body;
    expect(after.myCopy).toEqual({ id: own });
    await as(reader).delete(`/api/books/${own}`);
  });

  it("copies a friend's book with its cover into the reader's library, once", async () => {
    const source = await addBook(friend, 'R.U.R.', {
      author: 'Karel Čapek',
      isbn: OTHER_ISBN,
      publisher: 'Aventinum',
      readingStatus: 'read',
      rating: 3,
      review: 'Roboti!',
      notes: 'Private.',
    });
    const upload = await app
      .api()
      .post('/api/files')
      .set('Authorization', bearer(friend.token))
      .field('refType', 'book')
      .field('refId', source)
      .field('role', 'cover')
      .attach('file', PNG_SIGNATURE, { filename: 'cover.png', contentType: 'image/png' });
    expect(upload.status).toBe(CREATED);

    const copied = await as(reader).post(`/api/friends/${friend.id}/books/${source}/copy`);
    expect(copied.status).toBe(CREATED);
    expect(copied.body).toMatchObject({
      title: 'R.U.R.',
      author: 'Karel Čapek',
      isbn: OTHER_ISBN,
      publisher: 'Aventinum',
      readingStatus: 'want',
      rating: null,
      review: null,
      notes: null,
      ownerId: reader.id,
      activeLoan: null,
      shelves: [],
    });
    expect(copied.body.id).not.toBe(source);
    expect(copied.body.cover).toMatchObject({ refId: copied.body.id, ownerId: reader.id });
    expect(copied.body.cover.id).not.toBe(upload.body.id);
    const cover = await app.api().get(`/api/files/${copied.body.cover.id}`);
    expect(Buffer.from(cover.body)).toEqual(PNG_SIGNATURE);

    const again = await as(reader).post(`/api/friends/${friend.id}/books/${source}/copy`);
    expect(again.status).toBe(CONFLICT);

    // The friend deleting their book leaves the reader's copy and its cover alone.
    await as(friend).delete(`/api/books/${source}`);
    const kept = await as(reader).get(`/api/books/${copied.body.id}`);
    expect(kept.body.cover).toMatchObject({ id: copied.body.cover.id });

    const hidden = await addBook(friend, 'Hidden', { visibility: 'private' });
    expect((await as(reader).post(`/api/friends/${friend.id}/books/${hidden}/copy`)).status).toBe(
      NOT_FOUND
    );
    const quiet = await addBook(quietFriend, 'Quiet');
    expect(
      (await as(reader).post(`/api/friends/${quietFriend.id}/books/${quiet}/copy`)).status
    ).toBe(NOT_FOUND);
  });

  describe('recommendations', () => {
    it('go to friends, ring their bell, and put the book in their library', async () => {
      const book = await addBook(reader, 'Bylo nás pět', {
        author: 'Karel Poláček',
        visibility: 'private',
        notes: 'Mine.',
      });

      const sent = await as(reader).post('/api/recommendations', {
        bookId: book,
        recipientIds: [friend.id, quietFriend.id],
        message: '  Tohle si musíš přečíst.  ',
      });
      expect(sent.status).toBe(NO_CONTENT);

      const waiting = (await as(friend).get('/api/recommendations')).body;
      expect(waiting).toEqual([
        {
          id: expect.any(String),
          sender: expect.objectContaining({ id: reader.id, displayName: 'Věra' }),
          book: expect.objectContaining({ id: book, title: 'Bylo nás pět' }),
          message: 'Tohle si musíš přečíst.',
          sentAt: expect.any(String),
        },
      ]);
      const bell = (await as(friend).get('/api/notifications')).body.data;
      expect(bell[0]).toMatchObject({
        kind: 'recommendation',
        actor: { id: reader.id },
        book: { id: book, title: 'Bylo nás pět' },
      });

      // Sending it again doesn't tell anyone twice.
      await as(reader).post('/api/recommendations', { bookId: book, recipientIds: [friend.id] });
      expect((await as(friend).get('/api/recommendations')).body).toHaveLength(1);

      const accepted = await as(friend).post(`/api/recommendations/${waiting[0].id}/accept`);
      expect(accepted.body).toMatchObject({
        title: 'Bylo nás pět',
        author: 'Karel Poláček',
        ownerId: friend.id,
        readingStatus: 'want',
        notes: null,
      });
      expect((await as(friend).get('/api/recommendations')).body).toEqual([]);
      expect((await as(friend).post(`/api/recommendations/${waiting[0].id}/accept`)).status).toBe(
        NOT_FOUND
      );

      const [quiet] = (await as(quietFriend).get('/api/recommendations')).body;
      expect((await as(quietFriend).post(`/api/recommendations/${quiet.id}/dismiss`)).status).toBe(
        NO_CONTENT
      );
      expect((await as(quietFriend).get('/api/recommendations')).body).toEqual([]);
    });

    it('accepting a book the reader has already finds their copy', async () => {
      const book = await addBook(friend, 'Kytice', { isbn: '9788020400000' });
      const own = await addBook(reader, 'Kytice', { isbn: '9788020400000' });
      await as(friend).post('/api/recommendations', { bookId: book, recipientIds: [reader.id] });
      const [waiting] = (await as(reader).get('/api/recommendations')).body;
      const accepted = await as(reader).post(`/api/recommendations/${waiting.id}/accept`);
      expect(accepted.body.id).toBe(own);
    });

    it('only for the reader’s own books and friends', async () => {
      const friendsBook = await addBook(friend, 'Not mine');
      expect(
        (
          await as(reader).post('/api/recommendations', {
            bookId: friendsBook,
            recipientIds: [friend.id],
          })
        ).status
      ).toBe(NOT_FOUND);

      const book = await addBook(reader, 'Mine');
      const toStranger = await as(reader).post('/api/recommendations', {
        bookId: book,
        recipientIds: [stranger.id],
      });
      expect(toStranger.status).toBe(BAD_REQUEST);
      expect(
        (await as(reader).post('/api/recommendations', { bookId: book, recipientIds: [] })).status
      ).toBe(BAD_REQUEST);
      expect((await as(stranger).get('/api/recommendations')).body).toEqual([]);
    });

    it('lapse when the friendship ends', async () => {
      const book = await addBook(reader, 'Farewell');
      await as(reader).post('/api/recommendations', {
        bookId: book,
        recipientIds: [quietFriend.id],
      });
      expect((await as(quietFriend).get('/api/recommendations')).body).toHaveLength(1);
      await as(quietFriend).delete(`/api/friends/${reader.id}`);
      expect((await as(quietFriend).get('/api/recommendations')).body).toEqual([]);
    });
  });
});

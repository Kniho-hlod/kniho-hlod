import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, startTestApp } from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

describe('Shelves', () => {
  let app: TestApp;

  const signIn = async (email: string) => (await app.register(email)).body as { token: string };
  const create = (token: string, path: string, body: Record<string, unknown>) =>
    app.api().post(path).set('Authorization', bearer(token)).send(body);
  const read = (token: string, path: string, query: Record<string, string> = {}) =>
    app.api().get(path).query(query).set('Authorization', bearer(token));
  const setShelves = (token: string, bookId: string, shelfIds: unknown) =>
    app
      .api()
      .put(`/api/books/${bookId}/shelves`)
      .set('Authorization', bearer(token))
      .send({ shelfIds });
  const names = (shelves: { name: string }[]) => shelves.map((shelf) => shelf.name);

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("lists the reader's shelves in their order, each with its book count", async () => {
    const { token } = await signIn('shelf-order@test.cz');
    const { body: kids } = await create(token, '/api/shelves', { name: 'Dětský pokoj' });
    await create(token, '/api/shelves', { name: 'Oblíbené', sortOrder: 0, color: 'red' });
    await create(token, '/api/shelves', { name: 'Na rozdání', sortOrder: 1 });
    const { body: book } = await create(token, '/api/books', { title: 'Malý princ' });
    await setShelves(token, book.id, [kids.id]);

    const { body: list } = await read(token, '/api/shelves');

    expect(names(list.data)).toEqual(['Dětský pokoj', 'Oblíbené', 'Na rozdání']);
    expect(list.data[0]).toMatchObject({ bookCount: 1, color: 'neutral' });
    expect(list.data[1]).toMatchObject({ bookCount: 0, color: 'red' });
  });

  it('refuses a second shelf of the same name, whatever the letter case', async () => {
    const { token } = await signIn('shelf-names@test.cz');
    const { body: favourites } = await create(token, '/api/shelves', { name: 'Oblíbené' });
    const { body: other } = await create(token, '/api/shelves', { name: 'Jiné' });

    const duplicate = await create(token, '/api/shelves', { name: ' OBLÍBENÉ ' });
    const renamedOnto = await app
      .api()
      .patch(`/api/shelves/${other.id}`)
      .set('Authorization', bearer(token))
      .send({ name: 'oblíbené' });
    const renamedItself = await app
      .api()
      .patch(`/api/shelves/${favourites.id}`)
      .set('Authorization', bearer(token))
      .send({ name: 'Oblíbené', color: 'amber' });
    const { token: neighbour } = await signIn('shelf-names-2@test.cz');

    expect(duplicate.status).toBe(400);
    expect(duplicate.body.issues).toEqual([{ path: 'name', code: 'unique' }]);
    expect(renamedOnto.status).toBe(400);
    expect(renamedItself.status).toBe(200);
    expect((await create(neighbour, '/api/shelves', { name: 'Oblíbené' })).status).toBe(201);
  });

  it('puts a book on exactly the given shelves, and shows them with the book', async () => {
    const { token } = await signIn('shelf-books@test.cz');
    const { body: favourites } = await create(token, '/api/shelves', {
      name: 'Oblíbené',
      sortOrder: 0,
    });
    const { body: summer } = await create(token, '/api/shelves', { name: 'Léto', sortOrder: 1 });
    const { body: book } = await create(token, '/api/books', { title: 'Hobit' });

    const both = await setShelves(token, book.id, [summer.id, favourites.id, summer.id]);
    const onlySummer = await setShelves(token, book.id, [summer.id]);
    const detail = await read(token, `/api/books/${book.id}`);
    const none = await setShelves(token, book.id, []);

    expect(both.status).toBe(200);
    expect(both.body.shelves).toEqual([
      { id: favourites.id, name: 'Oblíbené', color: 'neutral' },
      { id: summer.id, name: 'Léto', color: 'neutral' },
    ]);
    expect(names(onlySummer.body.shelves)).toEqual(['Léto']);
    expect(names(detail.body.shelves)).toEqual(['Léto']);
    expect(none.body.shelves).toEqual([]);
  });

  it("keeps each reader's shelves and books to themselves", async () => {
    const owner = await signIn('shelf-owner@test.cz');
    const stranger = await signIn('shelf-stranger@test.cz');
    const { body: ownShelf } = await create(owner.token, '/api/shelves', { name: 'Moje' });
    const { body: ownBook } = await create(owner.token, '/api/books', { title: 'Moje kniha' });
    const { body: strangerBook } = await create(stranger.token, '/api/books', { title: 'Cizí' });

    const ontoForeignShelf = await setShelves(stranger.token, strangerBook.id, [ownShelf.id]);
    const foreignBook = await setShelves(stranger.token, ownBook.id, []);
    const unknownShelf = await setShelves(owner.token, ownBook.id, ['sh_missing']);
    const notAList = await setShelves(owner.token, ownBook.id, 'sh_x');

    expect(ontoForeignShelf.status).toBe(400);
    expect(ontoForeignShelf.body.issues).toEqual([{ path: 'shelfIds', code: 'reference' }]);
    expect(foreignBook.status).toBe(404);
    expect(unknownShelf.status).toBe(400);
    expect(notAList.status).toBe(400);
    expect((await read(stranger.token, '/api/shelves')).body.total).toBe(0);
    expect((await read(stranger.token, `/api/shelves/${ownShelf.id}`)).status).toBe(404);
    expect((await read(stranger.token, '/api/books', { shelf: ownShelf.id })).body.total).toBe(0);
  });

  it('filters the books by shelf, and by exact ISBN', async () => {
    const { token } = await signIn('shelf-filter@test.cz');
    const { body: shelf } = await create(token, '/api/shelves', { name: 'Fantasy' });
    const { body: empty } = await create(token, '/api/shelves', { name: 'Prázdná' });
    const { body: hobbit } = await create(token, '/api/books', {
      title: 'Hobit',
      isbn: '0-306-40615-2',
    });
    await create(token, '/api/books', { title: 'Babička' });
    await setShelves(token, hobbit.id, [shelf.id]);
    const titles = async (query: Record<string, string>) =>
      (await read(token, '/api/books', query)).body.data.map(
        (book: { title: string }) => book.title
      );

    expect(await titles({ shelf: shelf.id })).toEqual(['Hobit']);
    expect(await titles({ shelf: empty.id })).toEqual([]);
    expect(await titles({ isbn: '9780306406157' })).toEqual(['Hobit']);
    expect(await titles({ isbn: '978030640615' })).toEqual([]);
  });

  it('lets go of the books when a shelf goes, and of the shelves when a book goes', async () => {
    const { token } = await signIn('shelf-delete@test.cz');
    const auth = bearer(token);
    const { body: doomedShelf } = await create(token, '/api/shelves', { name: 'Pryč' });
    const { body: keptShelf } = await create(token, '/api/shelves', { name: 'Zůstává' });
    const { body: keptBook } = await create(token, '/api/books', { title: 'Zůstává' });
    const { body: doomedBook } = await create(token, '/api/books', { title: 'Pryč' });
    await setShelves(token, keptBook.id, [doomedShelf.id, keptShelf.id]);
    await setShelves(token, doomedBook.id, [keptShelf.id]);

    expect(
      (await app.api().delete(`/api/shelves/${doomedShelf.id}`).set('Authorization', auth)).status
    ).toBe(204);
    expect(
      (await app.api().delete(`/api/books/${doomedBook.id}`).set('Authorization', auth)).status
    ).toBe(204);

    const book = await read(token, `/api/books/${keptBook.id}`);
    const shelf = await read(token, `/api/shelves/${keptShelf.id}`);
    expect(names(book.body.shelves)).toEqual(['Zůstává']);
    expect(shelf.body.bookCount).toBe(1);
  });
});

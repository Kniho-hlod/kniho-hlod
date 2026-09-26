import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, PASSWORD, PNG_SIGNATURE, startTestApp } from './test-support/test-app';
import type { TestApp } from './test-support/test-app';

/** 10:00 UTC on 2026-09-25: the same day in Prague. */
const NOW = new Date('2026-09-25T10:00:00Z');

const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;

interface Account {
  id: string;
  token: string;
}

describe('Administration', () => {
  let app: TestApp;
  let admin: Account;
  let reader: Account;

  const signIn = async (email: string): Promise<Account> => {
    const { body } = await app.api().post('/api/auth/login').send({ email, password: PASSWORD });
    return { id: body.id, token: body.token };
  };

  const signUp = async (email: string): Promise<Account> => {
    const { body } = await app.register(email);
    return { id: body.id, token: body.token };
  };

  /** Registers, is made an administrator in the database, and signs in again for the claim. */
  const signUpAdmin = async (email: string): Promise<Account> => {
    await app.register(email);
    await app.core.models.user.update({ role: 'admin' }, { where: { email } });
    return signIn(email);
  };

  const as = ({ token }: Account) => ({
    get: (path: string) => app.api().get(path).set('Authorization', bearer(token)),
    post: (path: string, body: object = {}) =>
      app.api().post(path).set('Authorization', bearer(token)).send(body),
    put: (path: string, body: object) =>
      app.api().put(path).set('Authorization', bearer(token)).send(body),
    patch: (path: string, body: object) =>
      app.api().patch(path).set('Authorization', bearer(token)).send(body),
    delete: (path: string) => app.api().delete(path).set('Authorization', bearer(token)),
  });

  beforeAll(async () => {
    app = await startTestApp({ now: () => NOW });
    admin = await signUpAdmin('admin@kniho-hlod.test');
    reader = await signUp('reader@kniho-hlod.test');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('turns away readers and anonymous callers', async () => {
    expect((await app.api().get('/api/users')).status).toBe(UNAUTHORIZED);
    expect((await as(reader).get('/api/users')).status).toBe(FORBIDDEN);
    expect((await as(reader).get(`/api/users/${admin.id}`)).status).toBe(FORBIDDEN);
    expect((await as(reader).put(`/api/users/${reader.id}/role`, { role: 'admin' })).status).toBe(
      FORBIDDEN
    );
    expect((await as(reader).delete(`/api/users/${admin.id}`)).status).toBe(FORBIDDEN);
    expect((await as(reader).get('/api/admin/stats')).status).toBe(FORBIDDEN);
    expect((await app.api().get('/api/admin/stats')).status).toBe(UNAUTHORIZED);
  });

  it('lists accounts with their number of books, searchable, and never their passwords', async () => {
    await as(reader).post('/api/books', { title: 'Hobit' });
    await as(reader).post('/api/books', { title: 'Duna' });

    const res = await as(admin).get('/api/users').query({ q: 'reader@', limit: 10, page: 1 });

    expect(res.status).toBe(OK);
    expect(res.body).toMatchObject({ total: 1, page: 1, limit: 10 });
    expect(res.body.data[0]).toMatchObject({
      id: reader.id,
      email: 'reader@kniho-hlod.test',
      role: 'user',
      bookCount: 2,
    });
    expect(res.body.data[0]).not.toHaveProperty('password');
  });

  it('lets administrators neither create nor edit accounts', async () => {
    const create = await as(admin).post('/api/users', {
      email: 'new@kniho-hlod.test',
      password: PASSWORD,
      displayName: 'New',
    });
    const edit = await as(admin).patch(`/api/users/${reader.id}`, {
      password: 'hijacked-password',
    });

    expect([create.status, edit.status]).toEqual([FORBIDDEN, FORBIDDEN]);
    expect((await signIn('reader@kniho-hlod.test')).token).toBeTruthy();
  });

  it('changes the role of another account, never the caller’s own', async () => {
    const colleague = await signUp('colleague@kniho-hlod.test');

    const promoted = await as(admin).put(`/api/users/${colleague.id}/role`, { role: 'admin' });
    expect(promoted.status).toBe(OK);
    expect(promoted.body).toMatchObject({ id: colleague.id, role: 'admin', bookCount: 0 });
    expect(promoted.body).not.toHaveProperty('password');
    // The new role arrives with the next token.
    const asColleague = await signIn('colleague@kniho-hlod.test');
    expect((await as(asColleague).get('/api/users')).status).toBe(OK);

    const invalid = await as(admin).put(`/api/users/${colleague.id}/role`, { role: 'owner' });
    expect(invalid.status).toBe(BAD_REQUEST);
    expect(invalid.body.issues).toEqual([
      { path: 'role', code: 'enum', params: { values: ['user', 'admin'] } },
    ]);
    const own = await as(admin).put(`/api/users/${admin.id}/role`, { role: 'user' });
    expect(own.status).toBe(FORBIDDEN);
    const unknown = await as(admin).put('/api/users/u_nobody/role', { role: 'user' });
    expect(unknown.status).toBe(NOT_FOUND);
  });

  it('deletes another account with its library and files, never the caller’s own', async () => {
    const leaving = await signUp('leaving@kniho-hlod.test');
    const { body: book } = await as(leaving).post('/api/books', { title: 'Babička' });
    const { body: contact } = await as(leaving).post('/api/contacts', { name: 'Anna' });
    const lent = await as(leaving).post('/api/loans', {
      bookId: book.id,
      contactId: contact.id,
      lentAt: '2026-09-01',
    });
    expect(lent.status).toBe(CREATED);
    const cover = await app
      .api()
      .post('/api/files')
      .set('Authorization', bearer(leaving.token))
      .field('refType', 'book')
      .field('refId', book.id)
      .field('role', 'cover')
      .attach('file', PNG_SIGNATURE, { filename: 'cover.png', contentType: 'image/png' });
    expect(cover.status).toBe(CREATED);

    expect((await as(admin).delete(`/api/users/${leaving.id}`)).status).toBe(NO_CONTENT);

    const { models } = app.core;
    expect(await models.book.count({ where: { ownerId: leaving.id } })).toBe(0);
    expect(await models.loan.count({ where: { ownerId: leaving.id } })).toBe(0);
    expect(await models.File.count({ where: { ownerId: leaving.id } })).toBe(0);
    const signInAgain = await app
      .api()
      .post('/api/auth/login')
      .send({ email: 'leaving@kniho-hlod.test', password: PASSWORD });
    expect(signInAgain.status).toBe(UNAUTHORIZED);

    expect((await as(admin).delete(`/api/users/${admin.id}`)).status).toBe(FORBIDDEN);
  });

  it('counts the whole app for the administrators’ overview', async () => {
    const lender = await signUp('stats@kniho-hlod.test');
    const { body: book } = await as(lender).post('/api/books', { title: 'Krakatit' });
    const { body: contact } = await as(lender).post('/api/contacts', { name: 'Petr' });
    await as(lender).post('/api/loans', {
      bookId: book.id,
      contactId: contact.id,
      lentAt: '2026-09-01',
      dueAt: '2026-09-20',
    });
    await as(lender).patch('/api/auth/me', { emailReminders: false });

    const res = await as(admin).get('/api/admin/stats');

    expect(res.status).toBe(OK);
    // Admin, reader, colleague (now an admin) and the lender; the leaving account is gone.
    expect(res.body).toEqual({
      users: 4,
      newUsers: 4,
      admins: 2,
      remindersOn: 3,
      books: 3,
      contacts: 1,
      lent: 1,
      overdue: 1,
      newFeedback: 0,
    });
  });
});

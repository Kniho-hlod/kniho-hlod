import { describe, expect, it } from 'vitest';
import { findIsbnIssues, isValidIsbn10, isValidIsbn13, stripIsbn, toIsbn13 } from './isbn';

describe('ISBN', () => {
  it('strips separators and upper-cases the check character', () => {
    expect(stripIsbn(' 0-8044-2957-x ')).toBe('080442957X');
  });

  it('accepts what gets copied from a website: a label, dashes other than the hyphen', () => {
    for (const copied of [
      'ISBN 978-0-306-40615-7',
      'ISBN: 978-0-306-40615-7',
      'isbn-13: 978-0-306-40615-7',
      '978\u20130\u2013306\u201340615\u20137',
      '978\u20110\u2011306\u201140615\u20117',
      '978.0.306.40615.7',
    ]) {
      expect(toIsbn13(copied), copied).toBe('9780306406157');
    }
    expect(toIsbn13('ISBN-10: 0-306-40615-2')).toBe('9780306406157');
  });

  it('checks ISBN-10 check digits, including X for ten', () => {
    expect(isValidIsbn10('0306406152')).toBe(true);
    expect(isValidIsbn10('080442957X')).toBe(true);
    expect(isValidIsbn10('0306406153')).toBe(false);
    expect(isValidIsbn10('X306406152')).toBe(false);
  });

  it('checks ISBN-13 check digits and the 978/979 prefix', () => {
    expect(isValidIsbn13('9780306406157')).toBe(true);
    expect(isValidIsbn13('9791090636071')).toBe(true);
    expect(isValidIsbn13('9780306406158')).toBe(false);
    expect(isValidIsbn13('9770306406155')).toBe(false);
  });

  it('turns any valid ISBN into its ISBN-13', () => {
    expect(toIsbn13('978-0-306-40615-7')).toBe('9780306406157');
    expect(toIsbn13('0-306-40615-2')).toBe('9780306406157');
    expect(toIsbn13('0-8044-2957-X')).toBe('9780804429573');
  });

  it('rejects what is no ISBN', () => {
    expect(toIsbn13('978-0-306-40615-8')).toBeNull();
    expect(toIsbn13('hello')).toBeNull();
    expect(toIsbn13('')).toBeNull();
  });

  it('reports an invalid ISBN as a format issue, and none for an empty one', () => {
    expect(findIsbnIssues({ isbn: '12345' })).toEqual([
      { path: 'isbn', code: 'format', params: { format: 'isbn' } },
    ]);
    expect(findIsbnIssues({ isbn: '0-306-40615-2' })).toEqual([]);
    expect(findIsbnIssues({ isbn: null })).toEqual([]);
    expect(findIsbnIssues({})).toEqual([]);
  });
});

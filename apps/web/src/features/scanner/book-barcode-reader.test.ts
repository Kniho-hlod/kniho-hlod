import { describe, expect, it } from 'vitest';
import { findIsbn } from './book-barcode-reader';

describe('findIsbn', () => {
  it("takes the book's ISBN and skips other EAN-13 codes, such as a Czech product code", () => {
    expect(findIsbn([{ rawValue: '8594001021520' }, { rawValue: '9780306406157' }])).toBe(
      '9780306406157'
    );
  });

  it('finds nothing without a valid ISBN', () => {
    expect(findIsbn([])).toBeNull();
    expect(findIsbn([{ rawValue: '9780306406158' }])).toBeNull();
  });
});

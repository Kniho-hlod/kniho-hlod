import { describe, it, expect } from 'vitest';
import { findActiveRangeIssues } from './active-range';

describe('findActiveRangeIssues', () => {
  it('accepts a range that ends after it starts', () => {
    expect(
      findActiveRangeIssues({
        activeFrom: '2026-10-01T08:00:00.000Z',
        activeTo: '2026-10-01T10:00:00.000Z',
      })
    ).toEqual([]);
  });

  it.each([
    ['ends before it starts', '2026-10-02T00:00:00.000Z', '2026-10-01T00:00:00.000Z'],
    ['ends when it starts', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'],
  ])('rejects a range that %s', (_case, activeFrom, activeTo) => {
    expect(findActiveRangeIssues({ activeFrom, activeTo })).toEqual([
      { path: 'activeTo', code: 'min', params: { after: 'activeFrom' } },
    ]);
  });

  it('leaves a partial range alone', () => {
    expect(findActiveRangeIssues({ activeTo: '2026-10-01T00:00:00.000Z' })).toEqual([]);
  });
});

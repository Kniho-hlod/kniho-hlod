import type { ValidationIssue } from '@eleansphere/schema';

/** An ISO timestamp as a form or request sends it, or a `Date` as the database returns it. */
type Instant = string | Date;

interface ActiveRange {
  activeFrom?: Instant | null;
  activeTo?: Instant | null;
}

/**
 * An announcement must end after it starts. Checked when both ends are known — an update of one
 * end is checked together with the other's stored value.
 */
export function findActiveRangeIssues({ activeFrom, activeTo }: ActiveRange): ValidationIssue[] {
  if (!activeFrom || !activeTo) return [];
  if (new Date(activeTo).getTime() > new Date(activeFrom).getTime()) return [];
  return [{ path: 'activeTo', code: 'min', params: { after: 'activeFrom' } }];
}

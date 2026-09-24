import type { ValidationIssue } from '@eleansphere/schema';

interface ActiveRange {
  activeFrom?: string | null;
  activeTo?: string | null;
}

/**
 * An announcement must end after it starts. Checked only when both ends are present, so a partial
 * update of one end is left to the other's stored value.
 */
export function findActiveRangeIssues({ activeFrom, activeTo }: ActiveRange): ValidationIssue[] {
  if (!activeFrom || !activeTo) return [];
  if (Date.parse(activeTo) > Date.parse(activeFrom)) return [];
  return [{ path: 'activeTo', code: 'min', params: { after: 'activeFrom' } }];
}

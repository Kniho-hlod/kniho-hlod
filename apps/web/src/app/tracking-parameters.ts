import type { LocationQuery } from 'vue-router';

/**
 * Parameters other sites append to links for their own statistics: Facebook's `fbclid`, Google's
 * `gclid`, Microsoft's `msclkid`, Instagram's `igshid` and campaigns' `utm_*`. The app never reads
 * them; dropping them keeps the address clean, out of the sign-in `redirect` and out of links a
 * reader copies and shares on.
 */
const TRACKING_PARAMETERS = ['fbclid', 'gclid', 'msclkid', 'igshid'];
const TRACKING_PARAMETER_PREFIX = 'utm_';

function isTrackingParameter(name: string): boolean {
  return TRACKING_PARAMETERS.includes(name) || name.startsWith(TRACKING_PARAMETER_PREFIX);
}

/** The query without tracking parameters, or `null` when it has none to drop. */
export function withoutTrackingParameters(query: LocationQuery): LocationQuery | null {
  const entries = Object.entries(query);
  const kept = entries.filter(([name]) => !isTrackingParameter(name));
  return kept.length === entries.length ? null : Object.fromEntries(kept);
}

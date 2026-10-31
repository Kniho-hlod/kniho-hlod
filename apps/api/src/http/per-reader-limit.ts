import { createRateLimiter } from '@eleansphere/be-core';
import type { RateLimitConfig } from '@eleansphere/be-core';
import type { RequestHandler } from 'express';

/**
 * A rate limit per signed-in reader, to put after the token check; none when limits are off.
 * `name` keeps the budgets of different actions apart.
 */
export function perReaderLimit(name: string, limit: RateLimitConfig | 'off'): RequestHandler[] {
  if (limit === 'off') return [];
  return [createRateLimiter({ ...limit, keyOf: (req) => `${name}:${req.user?.id}` })];
}

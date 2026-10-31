import { describe, expect, it } from 'vitest';
import {
  createInvitationThrottle,
  INVITED_ADDRESS_COOLDOWN_MS,
  NEWCOMER_INVITATIONS_PER_DAY,
} from './invitation-throttle';

describe('Invitation e-mails', () => {
  it('reach one address once a week, whoever writes it how', () => {
    let now = new Date('2026-10-31T10:00:00Z');
    const throttle = createInvitationThrottle(() => now);

    expect(throttle.allow('anna@example.cz')).toBe(true);
    expect(throttle.allow(' Anna@Example.CZ')).toBe(false);
    expect(throttle.allow('boris@example.cz')).toBe(true);

    now = new Date(now.getTime() + INVITED_ADDRESS_COOLDOWN_MS - 1);
    expect(throttle.allow('anna@example.cz')).toBe(false);
    now = new Date(now.getTime() + 1);
    expect(throttle.allow('anna@example.cz')).toBe(true);
  });

  it('stop for the day once the app has sent its share, and go on the next', () => {
    let now = new Date('2026-10-31T10:00:00Z');
    const throttle = createInvitationThrottle(() => now);
    for (let index = 0; index < NEWCOMER_INVITATIONS_PER_DAY; index += 1) {
      expect(throttle.allow(`reader-${index}@example.cz`)).toBe(true);
    }

    expect(throttle.allow('one-more@example.cz')).toBe(false);
    now = new Date('2026-11-01T00:00:01Z');
    expect(throttle.allow('one-more@example.cz')).toBe(true);
  });
});

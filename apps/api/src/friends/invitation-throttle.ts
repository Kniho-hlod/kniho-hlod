const DAY_MS = 24 * 60 * 60 * 1000;

/** One invitation e-mail per address in this time, from whoever sends it. */
export const INVITED_ADDRESS_COOLDOWN_MS = 7 * DAY_MS;
/** Invitation e-mails to people without an account, from the whole app, per (UTC) day. */
export const NEWCOMER_INVITATIONS_PER_DAY = 100;

export interface InvitationThrottle {
  /**
   * Whether an invitation e-mail may go to this address now; counts it when it may. Never tells
   * the inviter: the answer to an invitation doesn't depend on the address.
   */
  allow(email: string): boolean;
}

/**
 * Keeps e-mail invitations from being used to send our e-mails to strangers in bulk: an address
 * hears from us once a week at most, and the app sends a limited number a day. Kept in memory,
 * like the rate limits: one API instance, and a restart only forgets a week of it.
 */
export function createInvitationThrottle(now: () => Date = () => new Date()): InvitationThrottle {
  const lastInvitedAt = new Map<string, number>();
  let day = '';
  let sentToday = 0;

  function startDay(at: number): void {
    const today = new Date(at).toISOString().slice(0, 10);
    if (today === day) return;
    day = today;
    sentToday = 0;
    for (const [address, invitedAt] of lastInvitedAt) {
      if (at - invitedAt >= INVITED_ADDRESS_COOLDOWN_MS) lastInvitedAt.delete(address);
    }
  }

  return {
    allow(email) {
      const at = now().getTime();
      startDay(at);
      const address = email.trim().toLowerCase();
      const invitedAt = lastInvitedAt.get(address);
      if (invitedAt !== undefined && at - invitedAt < INVITED_ADDRESS_COOLDOWN_MS) return false;
      if (sentToday >= NEWCOMER_INVITATIONS_PER_DAY) return false;
      sentToday += 1;
      lastInvitedAt.set(address, at);
      return true;
    },
  };
}

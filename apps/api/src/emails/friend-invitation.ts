import type { EmailTemplateFunction } from '@eleansphere/be-core';
import type { Locale } from '@kniho-hlod/domain';
import { escapeHtml } from './escape-html';

export interface FriendInvitationEmailData {
  /** The inviter's language: nothing is known about the person invited. */
  locale: Locale;
  inviterName: string;
  /** The inviter's invite link: registering through it makes the two friends. */
  inviteUrl: string;
}

interface InvitationCopy {
  subject(name: string): string;
  body(name: string): string;
  about: string;
  link: string;
}

const COPY: Record<Locale, InvitationCopy> = {
  cs: {
    subject: (name) => `${name} vás zve do Kniho-hlodu`,
    body: (name) => `${name} vás zve do Kniho-hlodu a chce být vaším přítelem.`,
    about:
      'Kniho-hlod je osobní knihovna a přehled o tom, komu jste co půjčili. S přáteli si můžete prohlížet knihovny a vidět, co kdo čte.',
    link: 'Přijmout pozvání',
  },
  en: {
    subject: (name) => `${name} invites you to Kniho-hlod`,
    body: (name) => `${name} invites you to Kniho-hlod and would like to be your friend.`,
    about:
      "Kniho-hlod is your personal library and a record of who has which of your books. Friends can browse each other's libraries and see what the other is reading.",
    link: 'Accept the invitation',
  },
};

/** Invites someone who has no account yet, through the inviter's own invite link. */
export const friendInvitationEmail: EmailTemplateFunction<FriendInvitationEmailData> = (data) => {
  const copy = COPY[data.locale];
  return {
    subject: copy.subject(data.inviterName),
    text: [copy.body(data.inviterName), '', copy.about, '', `${copy.link}: ${data.inviteUrl}`].join(
      '\n'
    ),
    html: `
      <p>${escapeHtml(copy.body(data.inviterName))}</p>
      <p>${escapeHtml(copy.about)}</p>
      <p><a href="${escapeHtml(data.inviteUrl)}">${escapeHtml(copy.link)}</a></p>
    `,
  };
};

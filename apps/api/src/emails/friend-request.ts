import type { EmailTemplateFunction } from '@eleansphere/be-core';
import type { Locale } from '@kniho-hlod/domain';
import { escapeHtml } from './escape-html';

export interface FriendRequestEmailData {
  /** The language of the reader asked. */
  locale: Locale;
  requesterName: string;
  /** The web app's friends page, where the request waits. */
  friendsUrl: string;
}

interface RequestCopy {
  subject(name: string): string;
  body(name: string): string;
  link: string;
  settings: string;
}

const COPY: Record<Locale, RequestCopy> = {
  cs: {
    subject: (name) => `${name} vás chce přidat do přátel — Kniho-hlod`,
    body: (name) =>
      `${name} vás v Kniho-hlodu žádá o přátelství. Přátelé si mohou prohlížet sdílené knihovny a vidí, co kdo čte.`,
    link: 'Odpovědět na žádost',
    settings: 'E-maily o žádostech vypnete v Nastavení účtu.',
  },
  en: {
    subject: (name) => `${name} wants to be your friend — Kniho-hlod`,
    body: (name) =>
      `${name} has sent you a friend request on Kniho-hlod. Friends can browse each other's shared libraries and see what the other is reading.`,
    link: 'Answer the request',
    settings: 'Turn these e-mails off in Account settings.',
  },
};

/** Tells a reader that another one asks to be their friend. */
export const friendRequestEmail: EmailTemplateFunction<FriendRequestEmailData> = (data) => {
  const copy = COPY[data.locale];
  return {
    subject: copy.subject(data.requesterName),
    text: [
      copy.body(data.requesterName),
      '',
      `${copy.link}: ${data.friendsUrl}`,
      '',
      copy.settings,
    ].join('\n'),
    html: `
      <p>${escapeHtml(copy.body(data.requesterName))}</p>
      <p><a href="${escapeHtml(data.friendsUrl)}">${escapeHtml(copy.link)}</a></p>
      <p style="color: #6b7280; font-size: 13px">${escapeHtml(copy.settings)}</p>
    `,
  };
};

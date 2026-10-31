import type { EmailTemplateFunction } from '@eleansphere/be-core';
import { DEFAULT_LOCALE, LOCALES } from '@kniho-hlod/domain';
import type { Locale } from '@kniho-hlod/domain';
import { escapeHtml } from './escape-html';

interface VerifyCopy {
  subject: string;
  greeting(name: string): string;
  body: string;
  link: string;
  notYou: string;
}

const COPY: Record<Locale, VerifyCopy> = {
  cs: {
    subject: 'Potvrďte svůj e-mail — Kniho-hlod',
    greeting: (name) => `Dobrý den, ${name},`,
    body: 'vítejte v Kniho-hlodu. Potvrďte prosím, že tahle adresa patří vám: teprve potom vám budou chodit upozornění a připomínky a půjde zvát přátele e-mailem. Odkaz platí týden.',
    link: 'Potvrdit e-mail',
    notYou: 'Pokud jste si účet nezakládali, e-mail klidně ignorujte.',
  },
  en: {
    subject: 'Confirm your email — Kniho-hlod',
    greeting: (name) => `Hello ${name},`,
    body: "welcome to Kniho-hlod. Please confirm that this address is yours: until then you won't get notifications or reminders and can't invite friends by email. The link is valid for a week.",
    link: 'Confirm email',
    notYou: "If you didn't create an account, you can ignore this email.",
  },
};

function toLocale(value: unknown): Locale {
  return LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}

/** The link that confirms a new account's address (be-core's `auth.emailVerification`). */
export const verifyEmail: EmailTemplateFunction<{
  verifyLink: string;
  user: Record<string, unknown>;
}> = ({ verifyLink, user }) => {
  const copy = COPY[toLocale(user.locale)];
  const greeting = copy.greeting(String(user.displayName ?? ''));
  return {
    subject: copy.subject,
    text: [greeting, '', copy.body, '', `${copy.link}: ${verifyLink}`, '', copy.notYou].join('\n'),
    html: `
      <p>${escapeHtml(greeting)}</p>
      <p>${escapeHtml(copy.body)}</p>
      <p><a href="${escapeHtml(verifyLink)}">${escapeHtml(copy.link)}</a></p>
      <p style="color: #6b7280; font-size: 13px">${escapeHtml(copy.notYou)}</p>
    `,
  };
};

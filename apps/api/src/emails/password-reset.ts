import type { EmailTemplateFunction } from '@eleansphere/be-core';
import { escapeHtml } from './escape-html';

/**
 * Sent in Czech and English at once: the reset request doesn't say which language the account
 * uses.
 */
export const passwordResetEmail: EmailTemplateFunction<{ resetLink: string }> = ({ resetLink }) => {
  const link = escapeHtml(resetLink);
  return {
    subject: 'Obnovení hesla · Password reset — Kniho-hlod',
    text: [
      'Dobrý den,',
      '',
      'někdo požádal o obnovení hesla k vašemu účtu v Kniho-hlodu. Nové heslo nastavíte na tomto',
      'odkazu, který platí hodinu a jen jednou:',
      resetLink,
      '',
      'Pokud jste o obnovení nežádali, e-mail klidně ignorujte.',
      '',
      '—',
      '',
      'Someone asked to reset the password of your Kniho-hlod account. Set a new one with this',
      'link, valid for one hour and only once:',
      resetLink,
      '',
      "If it wasn't you, you can ignore this email.",
    ].join('\n'),
    html: `
      <p>Dobrý den,</p>
      <p>někdo požádal o obnovení hesla k vašemu účtu v Kniho-hlodu. Odkaz platí hodinu a jen jednou.</p>
      <p><a href="${link}">Nastavit nové heslo</a></p>
      <p>Pokud jste o obnovení nežádali, e-mail klidně ignorujte.</p>
      <hr>
      <p>Someone asked to reset the password of your Kniho-hlod account. The link is valid for one hour and only once.</p>
      <p><a href="${link}">Set a new password</a></p>
      <p>If it wasn't you, you can ignore this email.</p>
    `,
  };
};

import { toStandardSchema } from '@eleansphere/entity-core';
import type { Fields, ToStandardSchemaOptions, ValidationIssue, ValidationMode } from '@eleansphere/entity-core';
import type { FormOutput } from '@eleansphere/entity-core';
import type { FormInputEvents } from '@nuxt/ui';
import { translate } from './i18n';

/**
 * When a `UForm` validates besides on submit: while typing and once a value is committed, but not
 * on blur alone. Leaving an untouched field (the autofocused e-mail, say) must not flash a
 * "required" error — it shifts the layout under the pointer, and the link being clicked moves away.
 */
export const VALIDATE_ON: FormInputEvents[] = ['input', 'change'];

/** `{ path: 'title', code: 'minLength', params: { minLength: 2 } }` → the translated message. */
export function translateIssue(issue: ValidationIssue): string {
  return translate(`validation.${issue.code}`, issue.params);
}

/**
 * A form schema for `UForm`, running the same rules the API does, with translated messages.
 *
 * ```ts
 * const schema = formSchema(userFields, 'create');
 * ```
 */
export function formSchema<F extends Fields, Mode extends ValidationMode>(
  fields: F,
  mode: Mode,
  options: Omit<ToStandardSchemaOptions<FormOutput<F, Mode>>, 'formatMessage'> = {}
) {
  return toStandardSchema(fields, mode, { ...options, formatMessage: translateIssue });
}

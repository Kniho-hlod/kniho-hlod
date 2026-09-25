import { toStandardSchema } from '@eleansphere/entity-core';
import type {
  Fields,
  ToStandardSchemaOptions,
  ValidationIssue,
  ValidationMode,
} from '@eleansphere/entity-core';
import type { FormOutput } from '@eleansphere/entity-core';
import type { FormInputEvents } from '@nuxt/ui';
import { isDateOnly } from '@eleansphere/schema';
import { formatDate } from './dates';
import { i18n, translate } from './i18n';

/**
 * When a `UForm` validates besides on submit: while typing and once a value is committed, but not
 * on blur alone. Leaving an untouched field (the autofocused e-mail, say) must not flash a
 * "required" error — it shifts the layout under the pointer, and the link being clicked moves away.
 */
export const VALIDATE_ON: FormInputEvents[] = ['input', 'change'];

/** `params.format` is a code such as `isbn`; `validation.formats.<code>` names it for the reader. */
function withReadableFormat(params: ValidationIssue['params']): ValidationIssue['params'] {
  const format = params?.format;
  if (typeof format !== 'string') return params;
  const key = `validation.formats.${format}`;
  return i18n.global.te(key) ? { ...params, format: translate(key) } : params;
}

/** `{ path: 'title', code: 'minLength', params: { minLength: 2 } }` → the translated message. */
export function translateIssue(issue: ValidationIssue): string {
  const min = issue.params?.min;
  if (issue.code === 'min' && isDateOnly(min)) {
    return translate('validation.minDate', { min: formatDate(min) });
  }
  return translate(`validation.${issue.code}`, withReadableFormat(issue.params));
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

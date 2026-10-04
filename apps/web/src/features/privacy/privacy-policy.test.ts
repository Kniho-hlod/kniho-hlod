import { describe, expect, it } from 'vitest';
import { isDateOnly } from '@eleansphere/schema';
import { LOCALES } from '@kniho-hlod/domain';
import { PRIVACY_POLICY, PRIVACY_POLICY_DATE } from './privacy-policy';

describe('The privacy policy', () => {
  it('says the same in every language, section by section', () => {
    const [first, ...others] = LOCALES.map((locale) => PRIVACY_POLICY[locale]);
    for (const sections of others) {
      expect(sections.map(({ paragraphs }) => paragraphs.length)).toEqual(
        first!.map(({ paragraphs }) => paragraphs.length)
      );
    }
    for (const sections of [first!, ...others]) {
      for (const { title, paragraphs } of sections) {
        expect(title.trim()).not.toBe('');
        for (const paragraph of paragraphs) expect(paragraph.trim()).not.toBe('');
      }
    }
  });

  it('is dated', () => {
    expect(isDateOnly(PRIVACY_POLICY_DATE)).toBe(true);
  });
});

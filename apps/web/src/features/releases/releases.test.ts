import { describe, expect, it } from 'vitest';
import { isDateOnly } from '@eleansphere/schema';
import { LOCALES } from '@kniho-hlod/domain';
import { compareVersions, CURRENT_RELEASE, RELEASES, releasesSince } from './releases';

const VERSION_PATTERN = /^\d+(\.\d+)+$/;

describe('compareVersions', () => {
  it('compares number by number, not letter by letter', () => {
    expect(compareVersions('1.10', '1.9')).toBeGreaterThan(0);
    expect(compareVersions('1.4', '1.4.1')).toBeLessThan(0);
    expect(compareVersions('2.0', '1.99')).toBeGreaterThan(0);
  });

  it('treats missing numbers as zeros', () => {
    expect(compareVersions('1.4', '1.4.0')).toBe(0);
  });
});

describe('The releases', () => {
  it('are numbered, dated and newest first, each version once', () => {
    for (const { version, date } of RELEASES) {
      expect(version).toMatch(VERSION_PATTERN);
      expect(isDateOnly(date)).toBe(true);
    }
    for (let index = 1; index < RELEASES.length; index += 1) {
      const [newer, older] = [RELEASES[index - 1]!, RELEASES[index]!];
      expect(compareVersions(newer.version, older.version)).toBeGreaterThan(0);
      expect(newer.date >= older.date).toBe(true);
    }
  });

  it('tell every reader what changed, in their language', () => {
    for (const release of RELEASES) {
      for (const locale of LOCALES) {
        expect(release.title[locale].trim()).not.toBe('');
        expect(release.notes[locale].length).toBeGreaterThan(0);
      }
      expect(release.notes.cs.length).toBe(release.notes.en.length);
    }
  });

  it('start with the version the app runs', () => {
    expect(CURRENT_RELEASE).toBe(RELEASES[0]);
  });

  it('pick the ones newer than the last seen', () => {
    const versions = (lastSeen: string) => releasesSince(lastSeen).map(({ version }) => version);

    expect(versions('1.2')).toEqual(expect.arrayContaining(['1.4', '1.3']));
    expect(versions('1.2')).not.toContain('1.2');
    expect(versions(CURRENT_RELEASE.version)).toEqual([]);
    expect(versions('0')).toHaveLength(RELEASES.length);
  });
});

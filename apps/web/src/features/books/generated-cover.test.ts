import { describe, expect, it } from 'vitest';
import { COVER_PALETTES, coverDesign } from './generated-cover';

const TITLES = [
  'Saturnin',
  'Krakatit',
  'Malý princ',
  'Babička',
  'Osudy dobrého vojáka Švejka',
  'R.U.R.',
  'Válka s mloky',
  'Spalovač mrtvol',
  'Hobit',
  'Duna',
  'Mistr a Markétka',
  'Sto roků samoty',
];
/** A dozen titles should never all land on a handful of looks. */
const MIN_DISTINCT_PALETTES = 5;

describe('generated cover', () => {
  it('always draws the same book the same way', () => {
    expect(coverDesign('Saturnin')).toEqual(coverDesign('Saturnin'));
  });

  it('ignores letter case and surrounding spaces', () => {
    expect(coverDesign('  SATURNIN ')).toEqual(coverDesign('saturnin'));
  });

  it('gives different books different colours', () => {
    const palettes = new Set(TITLES.map((title) => coverDesign(title).palette));
    expect(palettes.size).toBeGreaterThanOrEqual(MIN_DISTINCT_PALETTES);
  });

  it('only picks palettes it knows', () => {
    for (const title of TITLES) expect(COVER_PALETTES).toContain(coverDesign(title).palette);
  });
});

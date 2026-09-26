/**
 * A book without a cover image gets one drawn for it: colours and a motif picked from its title,
 * so the same book always looks the same and a shelf of them doesn't.
 */

/** Literal Tailwind classes — Tailwind only generates classes it finds written out whole. */
export interface CoverPalette {
  background: string;
  text: string;
  /** The motif's colour. */
  accent: string;
}

export const COVER_PALETTES: readonly CoverPalette[] = [
  { background: 'bg-rose-500', text: 'text-white', accent: 'bg-yellow-300' },
  { background: 'bg-indigo-500', text: 'text-white', accent: 'bg-orange-400' },
  { background: 'bg-yellow-300', text: 'text-ink-900', accent: 'bg-rose-500' },
  { background: 'bg-emerald-500', text: 'text-white', accent: 'bg-yellow-300' },
  { background: 'bg-orange-400', text: 'text-ink-900', accent: 'bg-indigo-500' },
  { background: 'bg-sky-300', text: 'text-ink-900', accent: 'bg-pink-400' },
  { background: 'bg-violet-500', text: 'text-white', accent: 'bg-lime-300' },
  { background: 'bg-pink-300', text: 'text-ink-900', accent: 'bg-emerald-500' },
];

export const COVER_MOTIFS = ['sun', 'stripes', 'arch', 'dots'] as const;
export type CoverMotif = (typeof COVER_MOTIFS)[number];

export interface CoverDesign {
  palette: CoverPalette;
  motif: CoverMotif;
}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a: a small, well-spread 32-bit hash — nothing here needs to be secure. */
function hashText(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (const character of text) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export function coverDesign(title: string): CoverDesign {
  const hash = hashText(title.trim().toLocaleLowerCase());
  const paletteIndex = hash % COVER_PALETTES.length;
  const motifIndex = Math.floor(hash / COVER_PALETTES.length) % COVER_MOTIFS.length;
  return { palette: COVER_PALETTES[paletteIndex], motif: COVER_MOTIFS[motifIndex] };
}

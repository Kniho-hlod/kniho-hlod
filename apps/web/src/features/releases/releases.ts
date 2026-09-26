import type { Locale } from '@kniho-hlod/domain';

/**
 * One version of the app as readers see it: a number, a day and what changed, in their words.
 * A change readers notice gets a new release on top of `RELEASES`: the next number (`1.5` after
 * `1.4`; `1.4.1` for fixes worth telling), today's date and notes in every language. A deploy
 * without one keeps the version; the build's commit still tells deploys apart.
 */
export interface Release {
  /** Numbers separated by dots, compared number by number: `1.10` is newer than `1.9`. */
  readonly version: string;
  /** `YYYY-MM-DD`. */
  readonly date: string;
  readonly title: Readonly<Record<Locale, string>>;
  readonly notes: Readonly<Record<Locale, readonly string[]>>;
}

/** Newest first. The first one is the version the app runs. */
export const RELEASES: readonly Release[] = [
  {
    version: '1.4',
    date: '2026-09-26',
    title: { cs: 'Verze a novinky', en: "Versions and what's new" },
    notes: {
      cs: [
        'Aplikace má číslo verze — najdete ho v menu pod avatarem a dole v Nastavení účtu.',
        'Po každé aktualizaci vám knihomol jednou řekne, co je nového. Celou historii najdete v menu pod „Co je nového“.',
      ],
      en: [
        'The app has a version number — find it in the menu under your avatar and at the bottom of Account settings.',
        "After each update the bookworm tells you once what's new. The whole history is under “What's new” in the menu.",
      ],
    },
  },
  {
    version: '1.3',
    date: '2026-09-26',
    title: { cs: 'Průvodce s knihomolem', en: 'A tour with the bookworm' },
    notes: {
      cs: [
        'Nové čtenáře provede aplikací knihomol: přehled, přidání knihy, poličky, výpůjčky a upomínky.',
        'Do prázdné knihovny si můžete nahrát ukázkové knihy a výpůjčky a jedním tlačítkem je zase smazat.',
        'Průvodce jde kdykoli přeskočit a znovu ho spustíte z menu pod avatarem.',
      ],
      en: [
        'The bookworm walks new readers through the app: the overview, adding books, shelves, loans and reminders.',
        'An empty library can be filled with sample books and loans, and cleared again with one button.',
        'Skip the tour any time, and take it again from the menu under your avatar.',
      ],
    },
  },
  {
    version: '1.2',
    date: '2026-09-26',
    title: { cs: 'Hlášení chyb a nápadů', en: 'Reporting bugs and ideas' },
    notes: {
      cs: [
        'Chybu nebo nápad nahlásíte z menu pod avatarem, klidně i s obrázkem obrazovky.',
        'Všechno, na co jde kliknout, na myš viditelně reaguje.',
      ],
      en: [
        'Report a bug or an idea from the menu under your avatar, with a screenshot if you like.',
        'Everything you can click now clearly reacts to the mouse.',
      ],
    },
  },
  {
    version: '1.1',
    date: '2026-09-26',
    title: { cs: 'Nový vzhled a návrat knihomola', en: 'A new look, and the bookworm is back' },
    notes: {
      cs: [
        'Hravější vzhled se světlým i tmavým režimem. Knihy bez obálky dostanou nakreslenou.',
        'U výpůjček vidíte, kolik dní zbývá do vrácení nebo kolik jich uplynulo po termínu.',
        'Knihomol je zpátky: v logu, na úvodní obrazovce s vtipnými hláškami i na přihlášení.',
      ],
      en: [
        'A more playful look, in light and dark. Books without a cover get one drawn.',
        'Loans say how many days are left until they are due, or how many have passed.',
        'The bookworm is back: in the logo, on the start screen with its jokes, and at sign-in.',
      ],
    },
  },
  {
    version: '1.0',
    date: '2026-09-26',
    title: { cs: 'Nový Kniho-hlod', en: 'The new Kniho-hlod' },
    notes: {
      cs: [
        'Kniho-hlod postavený znovu od základu: knihovna, výpůjčky a kontakty, kterým půjčujete.',
        'Knihu přidáte podle ISBN nebo načtením čárového kódu mobilem — údaje a obálku dohledají katalogy knihoven.',
        'Poličky, stav čtení a hodnocení. E-mailové upomínky před termínem vrácení i po něm.',
        'Kniho-hlod si nainstalujete na plochu telefonu jako aplikaci.',
      ],
      en: [
        'Kniho-hlod rebuilt from the ground up: your library, loans and the people you lend to.',
        'Add a book by its ISBN or by scanning the barcode with your phone — library catalogues fill in the details and the cover.',
        'Shelves, reading status and ratings. E-mail reminders before a book is due and after.',
        "Install Kniho-hlod on your phone's home screen like an app.",
      ],
    },
  },
];

export const CURRENT_RELEASE: Release = RELEASES[0] as Release;

/** The build's commit (`VERCEL_GIT_COMMIT_SHA`, see `vite.config.ts`), `dev` outside Vercel. */
export const BUILD: string = import.meta.env.VITE_APP_VERSION ?? 'dev';

/** Negative when `left` is older than `right`, positive when newer, 0 for the same version. */
export function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** Releases newer than the one the reader saw last, newest first. */
export function releasesSince(lastSeen: string): Release[] {
  return RELEASES.filter(({ version }) => compareVersions(version, lastSeen) > 0);
}

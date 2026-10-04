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
    version: '1.20',
    date: '2026-10-04',
    title: { cs: 'Seznam přání', en: 'A wish list' },
    notes: {
      cs: [
        'V Knihách je nový „Seznam přání“ na knihy, které byste rádi měli. Přátelé, kteří vidí vaši knihovnu, ho najdou na vaší stránce. Uvidí, jestli knihu mají a můžou vám ji půjčit, a tlačítkem „Daruji ji“ si ji zamluví jako dárek. Vy se nedozvíte kdo, ostatní přátelé jen to, že je zamluvená. Když knihu dostanete, klepněte na „Mám ji“ a přesune se do knihovny.',
      ],
      en: [
        'Books has a new “Wish list” for the books you would like to have. Friends who see your library find it on your page. They see whether they have the book to lend you, and with “I’ll give it” they claim it as a present. You won’t find out who, and other friends only see that it is taken. When you get the book, tap “Got it” and it moves into your library.',
      ],
    },
  },
  {
    version: '1.18',
    date: '2026-10-04',
    title: { cs: 'Celá polička najednou', en: 'A whole shelf at once' },
    notes: {
      cs: [
        'V Knihách je nové tlačítko „Hromadně“ s importem ze souboru a novým skenem celé poličky. Při skenu berte knihy jednu po druhé a přikládejte ke kameře čárový kód. Kamera zůstane zapnutá, každou knihu hned dohledáme i s obálkou a na konci je přidáte všechny najednou, klidně rovnou na poličku. Knihy, které už máte, přeskočíme.',
      ],
      en: [
        'Books has a new “In bulk” button with the import from a file and a new whole-shelf scan. When scanning, take the books one by one and hold each barcode up to the camera. The camera stays on, we look every book up with its cover, and at the end you add them all at once, straight onto a shelf if you like. Books you already have are skipped.',
      ],
    },
  },
  {
    version: '1.17',
    date: '2026-10-04',
    title: {
      cs: 'Knihovna z Goodreads a Databáze knih',
      en: 'Your library from Goodreads and Databáze knih',
    },
    notes: {
      cs: [
        'Knihy už nemusíte přepisovat ručně. V Knihách klepněte na „Importovat“ a nahrajte export z Goodreads (CSV) nebo z Databáze knih (Excel). Přeneseme názvy, autory, ISBN, hodnocení, stav čtení i poličky a knihy, které už máte, přeskočíme.',
      ],
      en: [
        'No more typing your books in by hand. In Books, tap “Import” and upload an export from Goodreads (CSV) or Databáze knih (Excel). We bring over titles, authors, ISBNs, ratings, reading status and shelves, and skip the books you already have.',
      ],
    },
  },
  {
    version: '1.16',
    date: '2026-10-04',
    title: { cs: 'Jak zacházíme s vašimi údaji', en: 'How we handle your data' },
    notes: {
      cs: [
        'Nová stránka „Ochrana soukromí“ popisuje, co o vás Kniho-hlod ukládá, kdo co vidí a jaká máte práva. Najdete ji dole na stránce Účet a u registrace.',
      ],
      en: [
        'A new “Privacy” page explains what Kniho-hlod stores about you, who sees what and what your rights are. You will find it at the foot of the Account page and when signing up.',
      ],
    },
  },
  {
    version: '1.15',
    date: '2026-09-30',
    title: { cs: 'Mají ji přátelé?', en: 'Do my friends have it?' },
    notes: {
      cs: [
        '„Mám ji už?“ teď u knihy, kterou nemáte, ukáže i přátele, kteří ji mají, a jestli je u nich doma. Klepnutím otevřete jejich výtisk a rovnou si o něj řeknete.',
      ],
      en: [
        "“Do I have it?” now also shows, for a book you don't have, the friends who do and whether it's at home with them. Tap to open their copy and ask to borrow it.",
      ],
    },
  },
  {
    version: '1.14',
    date: '2026-09-30',
    title: { cs: 'Profilový obrázek z jakékoli fotky', en: 'A profile picture from any photo' },
    notes: {
      cs: [
        'Profilový obrázek teď nahrajete z jakékoli fotky, i té velké z mobilu. Ořízneme ji na čtverec a zmenšíme, takže se rychle načte vám i přátelům.',
      ],
      en: [
        'You can now use any photo as your profile picture, even a large one from your phone. We crop it to a square and shrink it, so it loads quickly for you and your friends.',
      ],
    },
  },
  {
    version: '1.13',
    date: '2026-09-30',
    title: { cs: 'Opravy podle vašich hlášení', en: 'Fixes from your reports' },
    notes: {
      cs: [
        'Když na přehledu klepnete na „Právě čtu“, uvidíte jen knihy, které právě čtete.',
        'Při půjčování knihy teď v poli „Komu“ najdete i své přátele z Kniho-hlodu. Výpůjčku pak uvidí u sebe v „Mám půjčené“.',
        'Na mobilu jsme srovnali tlačítka v Knihách, na přehledu a u vyhledávání podle ISBN, aby se nemačkala. Dlouhé jméno přítele se už neusekává.',
      ],
      en: [
        'Tapping “Reading now” on the overview shows just the books you are reading.',
        'When you lend a book, the “To” field now offers your friends on Kniho-hlod too. They then see the loan under “Borrowed”.',
        "On phones, the buttons in Books, on the overview and by the ISBN search are lined up so they don't squeeze. A friend's long name is no longer cut off.",
      ],
    },
  },
  {
    version: '1.12',
    date: '2026-09-29',
    title: { cs: 'Obálky českých knih', en: 'Covers of Czech books' },
    notes: {
      cs: [
        'Když přidáte českou knihu podle ISBN, obálku teď hledáme i na Trhu knih. Najde se asi u poloviny českých knih, spíš u starších než u úplných novinek. Pro ostatní dál platí „Vyfotit obálku“.',
      ],
      en: [
        'Adding a Czech book by its ISBN now looks for its cover on Trh knih too. It finds about half of Czech books, older ones more than the very newest. For the rest, “Photograph the cover” is still there.',
      ],
    },
  },
  {
    version: '1.11',
    date: '2026-09-29',
    title: { cs: 'Mám ji už?', en: 'Do I have it?' },
    notes: {
      cs: [
        'V knihkupectví nebo antikvariátu naskenujete čárový kód a hned víte, jestli knihu už máte. Tlačítko „Mám ji už?“ najdete v Knihách na mobilu. Když ji nemáte, jedním klepnutím ji přidáte.',
        'Na mobilu obálku rovnou vyfotíte. Hodí se hlavně u českých knih, ke kterým katalogy obálku nemají, a formulář vám to řekne.',
      ],
      en: [
        "In a bookshop or a second-hand shop, scan the barcode and see at once whether you have the book. Find “Do I have it?” in Books on your phone. If you don't have it, add it with one tap.",
        "On a phone, photograph the cover right away. It helps most with Czech books the catalogues have no cover for, and the form tells you when that's the case.",
      ],
    },
  },
  {
    version: '1.10',
    date: '2026-09-29',
    title: { cs: 'Co čtou přátelé', en: 'What friends read' },
    notes: {
      cs: [
        'Na stránce Přátelé je nová záložka Novinky: kdo co čte, dočetl nebo si chce přečíst, s hodnocením.',
        'K hodnocení knihy můžete napsat recenzi pro přátele. Poznámky zůstávají jen vaše.',
        'U knihy uvidíte, kdo z přátel ji má taky a jak se mu líbila.',
        'Knihu přítele si jedním tlačítkem přidáte do své knihovny mezi knihy, které chcete číst.',
        'Svou knihu můžete doporučit přátelům se vzkazem (v nabídce „…“ u knihy). Doporučení od přátel čekají na přehledu.',
      ],
      en: [
        'The Friends page has a new News tab: who is reading, has finished or wants to read what, with their ratings.',
        'Next to your rating you can write a review for friends. Your notes stay yours.',
        'A book shows which friends have it too and how they liked it.',
        "One button puts a friend's book in your library, among the books you want to read.",
        'Recommend your books to friends with a message (in the “…” menu of a book). Recommendations from friends wait on the overview.',
      ],
    },
  },
  {
    version: '1.9',
    date: '2026-09-29',
    title: { cs: 'Opravy podle vašich hlášení', en: 'Fixes from your reports' },
    notes: {
      cs: [
        'Přečtenou knihu vrátíte zpátky na „Čtu“, „Chci číst“ nebo bez stavu v menu „…“ na jejím detailu. Data, která už neplatí, zmizí.',
        'Ukázky z průvodce smažete tlačítkem nahoře na kterékoli stránce, ne jen v Nastavení účtu.',
      ],
      en: [
        'Take a finished book back to Reading, Want to read or no status from the “…” menu on its page. Dates that no longer hold are cleared.',
        "Remove the tour's samples with the button at the top of any page, not only in Account settings.",
      ],
    },
  },
  {
    version: '1.8',
    date: '2026-09-29',
    title: { cs: 'Knihomol ukáže i přátele', en: 'The bookworm shows friends too' },
    notes: {
      cs: [
        'Průvodce aplikací má dva nové kroky: komentáře pod knihami přátel a půjčování od přátel.',
        'Znovu ho spustíte z menu pod avatarem.',
      ],
      en: [
        "The app tour has two new steps: comments under friends' books and borrowing from friends.",
        'Take it again from the menu under your avatar.',
      ],
    },
  },
  {
    version: '1.7',
    date: '2026-09-27',
    title: { cs: 'Komentáře', en: 'Comments' },
    notes: {
      cs: [
        'Pod knihami přátel i pod vlastními sdílenými knihami se dá psát. Komentáře vidí jen vlastník knihy a jeho přátelé.',
        'Svůj komentář upravíte nebo smažete; pod svou knihou smažete kterýkoli.',
        'Když vám někdo okomentuje knihu, ozve se zvoneček.',
      ],
      en: [
        "Write under your friends' books and under your own shared ones. Only the book's owner and their friends see the comments.",
        'Edit or delete your comments; under your own book you can delete any.',
        'The bell rings when someone comments on your book.',
      ],
    },
  },
  {
    version: '1.6',
    date: '2026-09-27',
    title: { cs: 'Půjčování mezi přáteli', en: 'Lending between friends' },
    notes: {
      cs: [
        'O knihu z knihovny přítele požádáte na jejím detailu — se vzkazem a návrhem, kdy ji vrátíte.',
        'Žádosti o vaše knihy najdete ve Výpůjčkách a na přehledu. Jedním tlačítkem knihu půjčíte a přítel se vám sám objeví v kontaktech.',
        'Nová záložka Mám půjčené ukáže, co máte od přátel a do kdy. Před termínem vám pošleme připomínku.',
      ],
      en: [
        "Ask for a book on its page in a friend's library — with a message and when you'd bring it back.",
        'Requests for your books wait in Loans and on the overview. One button lends the book, and the friend joins your contacts by themselves.',
        'The new Borrowed tab shows what you have from friends and until when. We remind you before it is due.',
      ],
    },
  },
  {
    version: '1.5',
    date: '2026-09-27',
    title: { cs: 'Přátelé', en: 'Friends' },
    notes: {
      cs: [
        'Pozvěte přátele odkazem, QR kódem nebo e-mailem — nová záložka Přátelé.',
        'Když knihovnu nasdílíte, přátelé uvidí vaše knihy, poličky a co zrovna čtete. Poznámky, výpůjčky a kontakty nikdy. Sdílení zapnete v Nastavení účtu, jednotlivé knihy jde skrýt.',
        'Prohlédněte si knihovny přátel a na přehledu uvidíte, co právě čtou.',
        'Zvoneček v hlavičce hlásí žádosti o přátelství a nové přátele.',
      ],
      en: [
        'Invite friends with a link, a QR code or by e-mail — there is a new Friends tab.',
        'Share your library and friends see your books, shelves and what you are reading — never your notes, loans or contacts. Turn sharing on in Account settings; single books can be hidden.',
        "Browse your friends' libraries, and see on the overview what they are reading.",
        'The bell in the header tells you about friend requests and new friends.',
      ],
    },
  },
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

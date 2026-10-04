import type { Locale } from '@kniho-hlod/domain';

/**
 * How Kniho-hlod handles readers' data, in their words. Content, so it lives here rather than in
 * the locale files; the type demands every language. A change to what the app stores or who it
 * sends data to changes this text and `PRIVACY_POLICY_DATE`.
 */
export interface PrivacySection {
  readonly title: string;
  readonly paragraphs: readonly string[];
}

/** `YYYY-MM-DD`: when the text last changed. */
export const PRIVACY_POLICY_DATE = '2026-10-04';

export const PRIVACY_POLICY: Readonly<Record<Locale, readonly PrivacySection[]>> = {
  cs: [
    {
      title: 'Kdo za Kniho-hlodem stojí',
      paragraphs: [
        'Kniho-hlod provozuje soukromá osoba jako nevýdělečný projekt a je správcem vašich osobních údajů. Ozvat se můžete přes „Nahlásit chybu nebo nápad“ v nabídce účtu.',
      ],
    },
    {
      title: 'Co o vás ukládáme',
      paragraphs: [
        'Účet: e-mail, jméno, heslo (jen jako otisk, který nejde převést zpět), profilový obrázek, jazyk, časové pásmo a vaše nastavení.',
        'Knihovnu: knihy, obálky, poličky, stav čtení, hodnocení, recenze a poznámky.',
        'Lidi, kterým půjčujete, a výpůjčky: jméno a kontakt, které zadáte, a kdy a co jste půjčili.',
        'Přátele: komu jste poslali žádost o přátelství, přátelství, komentáře, žádosti o půjčení, doporučení a upozornění. Když někoho pozvete e-mailem, pošleme mu jedinou zprávu s vaším odkazem a jeho adresu si neukládáme.',
        'Hlášení chyb a nápadů: text, případný snímek obrazovky, stránku, velikost okna a typ prohlížeče.',
        'Přihlášení: kdy jste se přihlásili nebo vrátili do aplikace. Podle toho počítáme, kolik čtenářů aplikaci používá.',
      ],
    },
    {
      title: 'K čemu je používáme',
      paragraphs: [
        'Jen k tomu, aby aplikace fungovala: ukázala vaši knihovnu, poslala upomínky a upozornění, které si necháte posílat, a propojila vás s přáteli. Právním základem je plnění smlouvy, tedy poskytování služby, o kterou jste si řekli.',
        'Správci aplikace vidí souhrnná čísla, například kolik je čtenářů a knih, a podle nich se rozhodují, co dál. Na to máme oprávněný zájem. Vaše poznámky ani knihovnu si neprohlížejí.',
        'Vaše údaje nikomu neprodáváme, nezobrazujeme reklamu a nepoužíváme žádné analytické nástroje ani sledovací cookies.',
      ],
    },
    {
      title: 'Co vidí ostatní',
      paragraphs: [
        'Přátelé vidí vaši knihovnu, jen když zapnete sdílení, a i pak jen knihy, které před nimi neskryjete, s hodnocením a recenzí. Poznámky, lidi, kterým půjčujete, a výpůjčky nevidí nikdy.',
        'Komentáře pod knihou vidí její majitel a jeho přátelé, kteří knihu vidí.',
      ],
    },
    {
      title: 'Lidé, kterým půjčujete',
      paragraphs: [
        'Jména a kontakty lidí, kterým půjčujete, zadáváte vy a vidíte je jen vy. Nikdy jim nic nepošleme. Výjimkou jsou vaši přátelé v Kniho-hlodu: ti dostanou upomínku k vypůjčené knize podle svého vlastního nastavení.',
      ],
    },
    {
      title: 'Kdo nám pomáhá',
      paragraphs: [
        'Server a databáze běží u Railway v datovém centru v Nizozemsku. Webovou aplikaci doručuje Vercel, obrázky ukládá Cloudflare R2 a e-maily posílá Resend. Tito zpracovatelé s údaji pracují jen pro nás.',
        'Když hledáte knihu podle ISBN, náš server se ptá Open Library, Google Books a Trhu knih. Posílá jim jen ISBN, nic o vás.',
        'U českých a slovenských knih se aplikace ptá také katalogu knihovny.cz přímo z vašeho prohlížeče. Ten tak uvidí vaši IP adresu, stejně jako u každé jiné webové stránky.',
      ],
    },
    {
      title: 'Ve vašem prohlížeči',
      paragraphs: [
        'Aplikace si v prohlížeči pamatuje vaše přihlášení, jazyk a vzhled. Cookies nepoužíváme.',
      ],
    },
    {
      title: 'Jak dlouho údaje držíme',
      paragraphs: [
        'Dokud máte účet. Když ho smažete (Účet → Smazat účet), smažeme i vaši knihovnu, výpůjčky, kontakty, soubory, komentáře a hlášení.',
      ],
    },
    {
      title: 'Vaše práva',
      paragraphs: [
        'Máte právo vědět, jaké údaje o vás máme, nechat je opravit nebo smazat, dostat je ve strojově čitelné podobě a vznést námitku proti zpracování. Většinu z toho zvládnete sami v aplikaci, o zbytek nám napište.',
        'Pokud si myslíte, že s údaji zacházíme špatně, můžete si stěžovat u Úřadu pro ochranu osobních údajů (uoou.gov.cz).',
      ],
    },
  ],
  en: [
    {
      title: 'Who runs Kniho-hlod',
      paragraphs: [
        'Kniho-hlod is run by a private individual as a non-profit project, who is the controller of your personal data. You can get in touch through “Report a bug or idea” in the account menu.',
      ],
    },
    {
      title: 'What we store about you',
      paragraphs: [
        'Your account: e-mail, name, password (only as a hash that cannot be turned back), profile picture, language, time zone and your settings.',
        'Your library: books, covers, shelves, reading status, ratings, reviews and notes.',
        'The people you lend to and your loans: the name and contact details you enter, and what you lent when.',
        'Friends: whom you sent a friend request, friendships, comments, borrow requests, recommendations and notifications. When you invite someone by e-mail, we send them a single message with your link and don’t keep their address.',
        'Bug reports and ideas: the text, a screenshot if you add one, the page, the window size and the kind of browser.',
        'Sign-ins: when you signed in or came back to the app. We use this to count how many readers use it.',
      ],
    },
    {
      title: 'What we use it for',
      paragraphs: [
        'Only to make the app work: to show your library, send the reminders and notifications you keep on, and connect you with friends. The legal basis is the performance of a contract, that is, providing the service you asked for.',
        'The app’s administrators see totals, such as how many readers and books there are, and use them to decide what comes next. This is our legitimate interest. They don’t look through your notes or your library.',
        'We never sell your data, show no ads and use no analytics tools or tracking cookies.',
      ],
    },
    {
      title: 'What others see',
      paragraphs: [
        'Friends see your library only when you turn sharing on, and even then only the books you don’t hide from them, with your rating and review. They never see your notes, the people you lend to or your loans.',
        'Comments under a book are seen by its owner and by the owner’s friends who can see the book.',
      ],
    },
    {
      title: 'The people you lend to',
      paragraphs: [
        'You enter the names and contact details of the people you lend to, and only you see them. We never send them anything. The exception is your friends on Kniho-hlod: they get a reminder about a borrowed book according to their own settings.',
      ],
    },
    {
      title: 'Who helps us',
      paragraphs: [
        'The server and database run at Railway in a data centre in the Netherlands. Vercel delivers the web app, Cloudflare R2 stores images and Resend sends e-mails. These processors work with the data only on our behalf.',
        'When you look up a book by ISBN, our server asks Open Library, Google Books and Trh knih. It sends them only the ISBN, nothing about you.',
        'For Czech and Slovak books the app also asks the knihovny.cz catalogue straight from your browser, so it sees your IP address, as any other website would.',
      ],
    },
    {
      title: 'In your browser',
      paragraphs: [
        'The app remembers your sign-in, language and appearance in your browser. We use no cookies.',
      ],
    },
    {
      title: 'How long we keep it',
      paragraphs: [
        'As long as you have an account. When you delete it (Account → Delete account), we also delete your library, loans, contacts, files, comments and reports.',
      ],
    },
    {
      title: 'Your rights',
      paragraphs: [
        'You have the right to know what data we hold about you, to have it corrected or deleted, to receive it in a machine-readable form and to object to its processing. You can do most of this yourself in the app; write to us for the rest.',
        'If you think we handle your data badly, you can complain to the Czech Office for Personal Data Protection (uoou.gov.cz).',
      ],
    },
  ],
};

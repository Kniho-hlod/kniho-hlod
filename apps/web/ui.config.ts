import type { NuxtUIOptions } from '@nuxt/ui/vite';

type UiTheme = NonNullable<NuxtUIOptions['ui']>;
type NeutralColor = NonNullable<NonNullable<UiTheme['colors']>['neutral']>;

/**
 * `--color-ink-*` in `src/assets/main.css`. Nuxt UI types `neutral` as one of Tailwind's own
 * greys, but it only ever reads the palette's CSS variables, so any palette defined there works.
 */
const INK = 'ink' as NeutralColor;

/** Outlined in ink and lifted off the page by a hard offset shadow, like a sticker. */
const POP = 'ring-0 shadow-pop';
/** Pressing a popped control pushes it flat onto its shadow. */
const PRESSABLE =
  'shadow-pop-sm transition-[color,background-color,box-shadow,translate] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none';
const OUTLINED_FIELD = 'ring-2 ring-accented';

/**
 * The app's look on top of Nuxt UI's components: indigo and orange on warm paper, ink outlines,
 * rounded shapes and stuck-on shadows. Colours and tokens live in `src/assets/main.css`.
 */
export const uiTheme: UiTheme = {
  colors: {
    primary: 'indigo',
    secondary: 'orange',
    success: 'emerald',
    info: 'sky',
    warning: 'amber',
    error: 'rose',
    neutral: INK,
  },
  button: {
    slots: { base: 'font-semibold' },
    compoundVariants: [
      { variant: 'solid', class: PRESSABLE },
      { color: 'neutral', variant: 'outline', class: 'ring-2 ring-line hover:bg-elevated' },
      {
        color: 'neutral',
        variant: 'subtle',
        class: 'bg-default ring-2 ring-line/25 hover:bg-elevated',
      },
    ],
  },
  badge: {
    slots: { base: 'font-semibold' },
    variants: {
      size: {
        sm: { base: 'rounded-full px-2' },
        md: { base: 'rounded-full px-2.5' },
        lg: { base: 'rounded-full px-3' },
      },
    },
  },
  alert: { slots: { root: 'rounded-xl', title: 'font-display font-bold' } },
  card: {
    slots: {
      root: 'rounded-xl',
      title: 'font-display text-lg font-bold',
    },
    variants: {
      variant: {
        outline: { root: 'ring-2 ring-line divide-line/15' },
      },
    },
  },
  input: { variants: { variant: { outline: OUTLINED_FIELD } } },
  inputNumber: { variants: { variant: { outline: OUTLINED_FIELD } } },
  inputMenu: { variants: { variant: { outline: OUTLINED_FIELD } } },
  textarea: { variants: { variant: { outline: OUTLINED_FIELD } } },
  select: { variants: { variant: { outline: OUTLINED_FIELD } } },
  selectMenu: { variants: { variant: { outline: OUTLINED_FIELD } } },
  tabs: {
    variants: {
      variant: {
        pill: { list: 'bg-default ring-2 ring-line rounded-xl', indicator: 'rounded-lg' },
      },
    },
  },
  dropdownMenu: { slots: { content: `${POP} rounded-xl` } },
  drawer: { slots: { content: 'ring-2 ring-line', title: 'font-display text-lg font-bold' } },
  modal: { slots: { title: 'font-display text-lg font-bold' } },
  popover: { slots: { content: `${POP} rounded-xl` } },
  toast: { slots: { root: `${POP} rounded-xl`, title: 'font-semibold' } },
};

import type { RouteLocationRaw } from 'vue-router';
import type { BookwormMood } from '@/components/PeekingBookworm.vue';

/**
 * What the tour points at: elements marked with `data-tour="…"` across the app. A mark may appear
 * twice (the header's and the tab bar's navigation); the tour picks the visible one.
 */
export const TOUR_TARGETS = {
  stats: 'home-stats',
  addBook: 'add-book',
  shelves: 'shelf-tabs',
  lend: 'lend-book',
  friends: 'invite-friends',
  comments: 'friends-list',
  borrow: 'loans-tabs',
  reminders: 'reminder-settings',
  accountMenu: 'account-menu',
} as const;
export type TourTarget = (typeof TOUR_TARGETS)[keyof typeof TOUR_TARGETS];

/** Each step's texts live under `onboarding.steps.<key>`. */
export type TourStepKey =
  | 'home'
  | 'books'
  | 'shelves'
  | 'loans'
  | 'friends'
  | 'comments'
  | 'borrow'
  | 'reminders'
  | 'done';

export interface TourStep {
  key: TourStepKey;
  /** The page the step shows. */
  route: RouteLocationRaw;
  target: TourTarget;
  mood: BookwormMood;
}

export const TOUR_STEPS: readonly TourStep[] = [
  { key: 'home', route: { name: 'home' }, target: TOUR_TARGETS.stats, mood: 'watching' },
  { key: 'books', route: { name: 'books' }, target: TOUR_TARGETS.addBook, mood: 'watching' },
  { key: 'shelves', route: { name: 'books' }, target: TOUR_TARGETS.shelves, mood: 'watching' },
  { key: 'loans', route: { name: 'loans' }, target: TOUR_TARGETS.lend, mood: 'watching' },
  // The invitation and the friends' list sit on the friends tab; a reader with friends would
  // otherwise open on news.
  {
    key: 'friends',
    route: { name: 'friends', query: { tab: 'people' } },
    target: TOUR_TARGETS.friends,
    mood: 'watching',
  },
  {
    key: 'comments',
    route: { name: 'friends', query: { tab: 'people' } },
    target: TOUR_TARGETS.comments,
    mood: 'happy',
  },
  {
    key: 'borrow',
    route: { name: 'loans', query: { tab: 'borrowed' } },
    target: TOUR_TARGETS.borrow,
    mood: 'watching',
  },
  {
    key: 'reminders',
    route: { name: 'account' },
    target: TOUR_TARGETS.reminders,
    mood: 'watching',
  },
  { key: 'done', route: { name: 'home' }, target: TOUR_TARGETS.accountMenu, mood: 'happy' },
];

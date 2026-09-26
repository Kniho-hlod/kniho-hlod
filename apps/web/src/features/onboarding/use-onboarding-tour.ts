import { readonly, ref } from 'vue';

/** Closed, greeting the reader, or showing one of `TOUR_STEPS`. */
export type TourState =
  { phase: 'closed' } | { phase: 'welcome' } | { phase: 'guiding'; stepIndex: number };

const state = ref<TourState>({ phase: 'closed' });

/**
 * The onboarding tour's one state for the whole app: `OnboardingTour` shows it, the account menu
 * starts it again.
 */
export function useOnboardingTour() {
  return {
    state: readonly(state),
    welcome(): void {
      state.value = { phase: 'welcome' };
    },
    guide(stepIndex: number): void {
      state.value = { phase: 'guiding', stepIndex };
    },
    close(): void {
      state.value = { phase: 'closed' };
    },
  };
}

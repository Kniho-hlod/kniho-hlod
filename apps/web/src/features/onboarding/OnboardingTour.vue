<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { describeError } from '@/app/errors';
import { useStartup } from '@/composables/use-startup';
import { useSessionStore } from '@/features/auth/session-store';
import { useFillSampleLibrary, useSampleLibrary } from './api';
import { TOUR_STEPS } from './tour-steps';
import TourGuide from './TourGuide.vue';
import TourSpotlight from './TourSpotlight.vue';
import TourWelcome from './TourWelcome.vue';
import { useOnboardingTour } from './use-onboarding-tour';

/**
 * The onboarding tour. It greets a reader on the home page until they finish or skip it once
 * (`onboardedAt`), and starts again from the account menu. Each step opens its page and rings
 * the thing it talks about.
 */
const { t } = useI18n();
const toast = useToast();
const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const tour = useOnboardingTour();
const isStarting = useStartup();

const isOpen = computed(() => tour.state.value.phase !== 'closed');
const { data: sampleLibrary } = useSampleLibrary(isOpen);
const { mutateAsync: fillSampleLibrary, isPending: isFilling } = useFillSampleLibrary();

/** Once per visit: a reader who closed the greeting isn't greeted again before a reload. */
let hasGreeted = false;

// After the splash screen, not under it.
watch(
  [() => route.name, () => session.user?.onboardedAt, isStarting],
  ([routeName, onboardedAt, starting]) => {
    if (hasGreeted || starting || routeName !== 'home' || !session.user || onboardedAt) return;
    hasGreeted = true;
    tour.welcome();
  },
  { immediate: true }
);

// Signing out ends the tour; the next reader starts without it.
onBeforeUnmount(() => tour.close());

const stepIndex = computed(() =>
  tour.state.value.phase === 'guiding' ? tour.state.value.stepIndex : null
);
const step = computed(() => (stepIndex.value === null ? null : TOUR_STEPS[stepIndex.value]));

const stepText = computed(() => {
  if (!step.value) return '';
  const text = t(`onboarding.steps.${step.value.key}.text`);
  return step.value.key === 'done' && sampleLibrary.value?.present
    ? `${text} ${t('onboarding.samplesNote')}`
    : text;
});

/** The page first, then the step: its ring looks for the element on the new page. */
async function showStep(index: number): Promise<void> {
  const next = TOUR_STEPS[index];
  if (!next) return;
  await router.push(next.route);
  tour.guide(index);
}

async function start(fillSamples: boolean): Promise<void> {
  if (fillSamples) {
    try {
      await fillSampleLibrary();
    } catch (err) {
      // The tour works on an empty library too.
      toast.add({ title: describeError(err, { conflict: t('samples.conflict') }), color: 'error' });
    }
  }
  await showStep(0);
}

async function end(): Promise<void> {
  tour.close();
  if (!session.user || session.user.onboardedAt) return;
  try {
    await session.updateProfile({ onboardedAt: new Date().toISOString() });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}

/** The greeting was closed or skipped — not merely left for the first step. */
async function skipWelcome(): Promise<void> {
  if (tour.state.value.phase === 'welcome') await end();
}

async function next(): Promise<void> {
  if (stepIndex.value === null) return;
  if (stepIndex.value + 1 < TOUR_STEPS.length) await showStep(stepIndex.value + 1);
  else await end();
}

async function back(): Promise<void> {
  if (stepIndex.value !== null) await showStep(stepIndex.value - 1);
}
</script>

<template>
  <TourWelcome
    :open="tour.state.value.phase === 'welcome'"
    :can-fill-samples="sampleLibrary?.canFill ?? false"
    :is-starting="isFilling"
    @start="start"
    @skip="skipWelcome"
  />
  <template v-if="step && stepIndex !== null">
    <TourSpotlight :target="step.target" />
    <TourGuide
      :title="t(`onboarding.steps.${step.key}.title`)"
      :text="stepText"
      :mood="step.mood"
      :step-number="stepIndex + 1"
      :step-count="TOUR_STEPS.length"
      @back="back"
      @next="next"
      @end="end"
    />
  </template>
</template>

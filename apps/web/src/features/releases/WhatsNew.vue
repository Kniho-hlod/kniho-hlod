<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import PeekingBookworm from '@/components/PeekingBookworm.vue';
import { useStartup } from '@/composables/use-startup';
import { useSessionStore } from '@/features/auth/session-store';
import { useOnboardingTour } from '@/features/onboarding/use-onboarding-tour';
import { BUILD, CURRENT_RELEASE, RELEASES, releasesSince } from './releases';
import ReleaseList from './ReleaseList.vue';
import { useReleaseNotes } from './use-release-notes';

/**
 * "What's new": once a reader who knows the app (`onboardedAt`) runs a release newer than the
 * last one they saw (`lastSeenRelease`), the bookworm lists what changed — after the splash
 * screen and never over the tour. Closing it records the release. A reader the app hasn't
 * recorded yet (a new account after its tour) is recorded quietly: the tour told them enough.
 * The account menu opens the whole history.
 */
const { t } = useI18n();
const session = useSessionStore();
const isStarting = useStartup();
const tour = useOnboardingTour();
const releaseNotes = useReleaseNotes();

/** Once per visit. */
let hasChecked = false;

async function recordCurrentRelease(): Promise<void> {
  if (session.user?.lastSeenRelease === CURRENT_RELEASE.version) return;
  // A failed save only means the news comes again next time.
  await session.updateProfile({ lastSeenRelease: CURRENT_RELEASE.version }).catch(() => undefined);
}

watch(
  [
    () => session.user?.onboardedAt,
    () => session.user?.lastSeenRelease,
    isStarting,
    () => tour.state.value.phase,
  ],
  ([onboardedAt, lastSeenRelease, starting, tourPhase]) => {
    if (hasChecked || starting || !onboardedAt || tourPhase !== 'closed') return;
    hasChecked = true;
    if (!lastSeenRelease) {
      void recordCurrentRelease();
      return;
    }
    const news = releasesSince(lastSeenRelease);
    if (news.length > 0) releaseNotes.showNews(news);
  },
  { immediate: true }
);

// Signing out closes it; the next reader gets their own.
onBeforeUnmount(() => releaseNotes.close());

const view = computed(() => releaseNotes.state.value);
const isOpen = computed(() => view.value.view !== 'closed');
const shownReleases = computed(() => (view.value.view === 'news' ? view.value.releases : RELEASES));

/** Whichever way the notes were opened, the reader has now seen them. */
async function close(): Promise<void> {
  releaseNotes.close();
  await recordCurrentRelease();
}

function onOpenChange(open: boolean): void {
  if (!open) void close();
}
</script>

<template>
  <UModal
    :open="isOpen"
    :title="
      view.view === 'news'
        ? t('releases.newsTitle', { version: CURRENT_RELEASE.version })
        : t('releases.whatsNew')
    "
    :description="t('releases.intro')"
    :ui="{ description: 'sr-only' }"
    @update:open="onOpenChange"
  >
    <template #body>
      <div class="flex flex-col gap-5">
        <div v-if="view.view === 'news'" class="flex items-center gap-3">
          <PeekingBookworm mood="happy" class="size-14 shrink-0" />
          <p class="font-semibold text-highlighted">{{ t('releases.intro') }}</p>
        </div>
        <ReleaseList :releases="shownReleases" />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <UButton
          v-if="view.view === 'news'"
          color="neutral"
          variant="ghost"
          @click="releaseNotes.showHistory()"
        >
          {{ t('releases.history') }}
        </UButton>
        <p v-else class="text-xs text-muted">
          {{ t('releases.versionWithBuild', { version: CURRENT_RELEASE.version, build: BUILD }) }}
        </p>
        <UButton @click="close">{{ t('releases.thanks') }}</UButton>
      </div>
    </template>
  </UModal>
</template>

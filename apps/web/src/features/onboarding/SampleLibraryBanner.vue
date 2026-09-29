<script lang="ts">
import { ref } from 'vue';

/** "Zatím nechat" holds for this visit: the banner is back after a reload. */
const isKeptForNow = ref(false);
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useSampleLibrary } from './api';
import { useOnboardingTour } from './use-onboarding-tour';
import { useSampleRemoval } from './use-sample-removal';

/**
 * Over every page while the tour's samples are in the library, so a reader who finished the tour
 * needn't look for them in the account settings. Not during the tour, which shows the samples
 * off, and not on the account page, whose card offers the same.
 */
const { t } = useI18n();
const route = useRoute();
const tour = useOnboardingTour();
const { data: sampleLibrary } = useSampleLibrary();
const { isConfirming, isRemoving, remove } = useSampleRemoval();

const isShown = computed(
  () =>
    (sampleLibrary.value?.present ?? false) &&
    !isKeptForNow.value &&
    tour.state.value.phase === 'closed' &&
    route.name !== 'account'
);
</script>

<template>
  <section
    v-if="isShown"
    :aria-label="t('samples.title')"
    class="flex flex-col gap-3 rounded-xl bg-yellow-100 px-4 py-3 ring-2 ring-line sm:flex-row sm:items-center dark:bg-yellow-400/15"
  >
    <UIcon name="i-lucide-sparkles" class="hidden size-5 shrink-0 text-secondary sm:block" />

    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <template v-if="!isConfirming">
        <p class="font-bold text-highlighted">{{ t('samples.bannerTitle') }}</p>
        <p class="text-sm text-toned">{{ t('samples.bannerText') }}</p>
      </template>
      <p v-else class="text-sm font-semibold text-highlighted">{{ t('samples.confirm') }}</p>
    </div>

    <div v-if="!isConfirming" class="flex flex-wrap gap-2">
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-trash-2"
        @click="isConfirming = true"
      >
        {{ t('samples.removeShort') }}
      </UButton>
      <UButton color="neutral" variant="ghost" @click="isKeptForNow = true">
        {{ t('samples.keepForNow') }}
      </UButton>
    </div>
    <div v-else class="flex flex-wrap gap-2">
      <UButton color="error" :loading="isRemoving" @click="remove">
        {{ t('samples.remove') }}
      </UButton>
      <UButton color="neutral" variant="ghost" @click="isConfirming = false">
        {{ t('common.cancel') }}
      </UButton>
    </div>
  </section>
</template>

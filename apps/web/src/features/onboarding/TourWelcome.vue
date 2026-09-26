<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PeekingBookworm from '@/components/PeekingBookworm.vue';

/**
 * The tour's first word: the bookworm says hello and offers a walk through the app, with the
 * sample library when the library is still empty. Closing it any way means "skip".
 */
defineProps<{
  open: boolean;
  /** Offer the sample library: the reader's library is empty. */
  canFillSamples: boolean;
  isStarting: boolean;
}>();

const emit = defineEmits<{
  start: [fillSamples: boolean];
  skip: [];
}>();

const { t } = useI18n();
const fillSamples = ref(true);

function onOpenChange(isOpen: boolean): void {
  if (!isOpen) emit('skip');
}
</script>

<template>
  <UModal
    :open="open"
    :title="t('onboarding.welcome.title')"
    :description="t('onboarding.welcome.text')"
    :ui="{ description: 'sr-only' }"
    @update:open="onOpenChange"
  >
    <template #body>
      <div class="flex flex-col gap-5">
        <div class="flex items-start gap-4">
          <PeekingBookworm mood="watching" class="size-20 shrink-0" />
          <p class="relative rounded-xl bg-yellow-100 p-3 text-ink-900 ring-2 ring-line">
            <span
              aria-hidden="true"
              class="absolute top-6 -left-[9px] size-4 rotate-45 border-b-2 border-l-2 border-line bg-yellow-100"
            />
            {{ t('onboarding.welcome.text') }}
          </p>
        </div>

        <UFormField
          v-if="canFillSamples"
          :label="t('onboarding.welcome.fillSamples')"
          :description="t('onboarding.welcome.fillSamplesHint')"
          orientation="horizontal"
          class="rounded-xl p-3 ring-2 ring-line/15"
        >
          <USwitch v-model="fillSamples" :aria-label="t('onboarding.welcome.fillSamples')" />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div
        class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <UButton color="neutral" variant="ghost" class="justify-center" @click="emit('skip')">
          {{ t('onboarding.welcome.skip') }}
        </UButton>
        <UButton
          trailing-icon="i-lucide-arrow-right"
          class="justify-center"
          :loading="isStarting"
          @click="emit('start', canFillSamples && fillSamples)"
        >
          {{ t('onboarding.welcome.start') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

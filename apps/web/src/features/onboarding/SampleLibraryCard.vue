<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useSampleLibrary } from './api';
import { useSampleRemoval } from './use-sample-removal';

/**
 * On the account page while the tour's samples are in the library: removes them all at once,
 * after a second click. The reader's own books stay.
 */
const { t } = useI18n();
const { data: sampleLibrary } = useSampleLibrary();
const { isConfirming, isRemoving, remove } = useSampleRemoval();
</script>

<template>
  <UCard v-if="sampleLibrary?.present" class="bg-yellow-100 dark:bg-yellow-400/15">
    <div class="flex flex-col gap-3">
      <h2 class="flex items-center gap-2 text-lg font-bold text-highlighted">
        <UIcon name="i-lucide-sparkles" class="size-5 text-secondary" />
        {{ t('samples.title') }}
      </h2>
      <p class="text-sm text-toned">{{ t('samples.text') }}</p>

      <div v-if="!isConfirming">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-trash-2"
          @click="isConfirming = true"
        >
          {{ t('samples.remove') }}
        </UButton>
      </div>
      <div v-else class="flex flex-col gap-3">
        <p class="text-sm font-semibold text-highlighted">{{ t('samples.confirm') }}</p>
        <div class="flex flex-wrap gap-2">
          <UButton color="error" :loading="isRemoving" @click="remove">
            {{ t('samples.remove') }}
          </UButton>
          <UButton color="neutral" variant="ghost" @click="isConfirming = false">
            {{ t('common.cancel') }}
          </UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>

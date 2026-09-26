<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import PeekingBookworm from '@/components/PeekingBookworm.vue';
import type { BookwormMood } from '@/components/PeekingBookworm.vue';

/**
 * One step of the tour: the bookworm peeks over a card that floats above the page (over the
 * phone's tab bar, in the corner on a desktop), and the page stays usable underneath.
 */
const props = defineProps<{
  title: string;
  text: string;
  mood: BookwormMood;
  /** From 1. */
  stepNumber: number;
  stepCount: number;
}>();

const emit = defineEmits<{
  back: [];
  next: [];
  end: [];
}>();

const { t } = useI18n();

const isFirst = computed(() => props.stepNumber === 1);
const isLast = computed(() => props.stepNumber === props.stepCount);
</script>

<template>
  <section
    :aria-label="t('onboarding.label')"
    class="fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96"
  >
    <div class="relative pt-12">
      <PeekingBookworm :mood="mood" class="absolute top-0 left-5 size-16" />
      <div
        class="relative flex flex-col gap-3 rounded-xl bg-default p-4 ring-2 ring-line shadow-pop"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs font-bold tracking-wide text-muted uppercase">
            {{ t('onboarding.progress', { current: stepNumber, total: stepCount }) }}
          </p>
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            trailing-icon="i-lucide-x"
            :aria-label="t('onboarding.endLabel')"
            @click="emit('end')"
          >
            {{ t('onboarding.end') }}
          </UButton>
        </div>

        <div aria-live="polite" class="flex flex-col gap-1">
          <h2 class="font-display text-lg leading-tight font-bold text-highlighted">{{ title }}</h2>
          <p class="text-sm text-toned">{{ text }}</p>
        </div>

        <div class="flex items-center justify-between gap-2">
          <ol class="flex gap-1.5" aria-hidden="true">
            <li
              v-for="number in stepCount"
              :key="number"
              class="size-2 rounded-full"
              :class="number === stepNumber ? 'bg-secondary ring-1 ring-line' : 'bg-accented'"
            />
          </ol>
          <div class="flex gap-2">
            <UButton v-if="!isFirst" color="neutral" variant="ghost" @click="emit('back')">
              {{ t('onboarding.back') }}
            </UButton>
            <UButton
              :trailing-icon="isLast ? 'i-lucide-party-popper' : 'i-lucide-arrow-right'"
              @click="emit('next')"
            >
              {{ isLast ? t('onboarding.finish') : t('onboarding.next') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

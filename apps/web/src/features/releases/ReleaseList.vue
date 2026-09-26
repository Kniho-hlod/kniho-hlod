<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { DEFAULT_LOCALE, LOCALES } from '@kniho-hlod/domain';
import type { Locale } from '@kniho-hlod/domain';
import { formatDate } from '@/app/dates';
import { CURRENT_RELEASE } from './releases';
import type { Release } from './releases';

/** Releases with their notes, newest first; the one the app runs is marked. */
defineProps<{ releases: readonly Release[] }>();

const { t, locale } = useI18n();

const language = computed<Locale>(
  () => LOCALES.find((code) => code === locale.value) ?? DEFAULT_LOCALE
);
</script>

<template>
  <ol class="flex flex-col gap-5">
    <li v-for="release in releases" :key="release.version" class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="rounded-full bg-primary px-2 py-0.5 font-display text-sm font-bold text-inverted ring-2 ring-line"
        >
          {{ release.version }}
        </span>
        <h3 class="font-display text-base font-bold text-highlighted">
          {{ release.title[language] }}
        </h3>
        <UBadge
          v-if="release.version === CURRENT_RELEASE.version"
          color="secondary"
          variant="subtle"
          size="sm"
        >
          {{ t('releases.current') }}
        </UBadge>
      </div>
      <p class="text-xs text-muted">{{ formatDate(release.date) }}</p>
      <ul class="flex list-disc flex-col gap-1 pl-5 text-sm text-toned marker:text-secondary">
        <li v-for="note in release.notes[language]" :key="note">{{ note }}</li>
      </ul>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { BUILD, CURRENT_RELEASE } from './releases';
import { useReleaseNotes } from './use-release-notes';

/** Which version of the app this is, with the ways to what's new and to privacy: a page's foot. */
const { t } = useI18n();
const releaseNotes = useReleaseNotes();
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted">
    <span>
      Kniho-hlod
      {{ t('releases.versionWithBuild', { version: CURRENT_RELEASE.version, build: BUILD }) }}
    </span>
    <UButton
      color="neutral"
      variant="link"
      size="sm"
      icon="i-lucide-sparkles"
      @click="releaseNotes.showHistory()"
    >
      {{ t('releases.whatsNew') }}
    </UButton>
    <UButton
      :to="{ name: 'privacy' }"
      color="neutral"
      variant="link"
      size="sm"
      icon="i-lucide-shield-check"
    >
      {{ t('privacy.link') }}
    </UButton>
  </div>
</template>

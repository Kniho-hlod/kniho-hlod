<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useSessionStore } from '@/features/auth/session-store';

const { t } = useI18n();
const session = useSessionStore();
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold text-highlighted">
      {{ t('home.welcome', { name: session.user?.displayName ?? '' }) }}
    </h1>

    <UCard>
      <div class="flex items-start gap-3">
        <UIcon name="i-lucide-book-open" class="size-6 text-primary shrink-0" />
        <div class="flex flex-col items-start gap-3">
          <p class="text-muted">{{ t('home.empty') }}</p>
          <UButton :to="{ name: 'books' }" icon="i-lucide-library" variant="subtle">
            {{ t('home.toBooks') }}
          </UButton>
        </div>
      </div>
    </UCard>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { DEFAULT_LOCALE, LOCALES } from '@kniho-hlod/domain';
import type { Locale } from '@kniho-hlod/domain';
import { formatDate } from '@/app/dates';
import AppLogo from '@/components/AppLogo.vue';
import AppearanceMenu from '@/components/AppearanceMenu.vue';
import { PRIVACY_POLICY, PRIVACY_POLICY_DATE } from '@/features/privacy/privacy-policy';

/** How Kniho-hlod handles readers' data: for visitors and readers alike. */
const { t, locale } = useI18n();

const language = computed<Locale>(
  () => LOCALES.find((code) => code === locale.value) ?? DEFAULT_LOCALE
);
</script>

<template>
  <div class="min-h-dvh bg-paper flex flex-col">
    <header class="flex items-center justify-between p-4">
      <RouterLink to="/" class="group rounded-lg">
        <AppLogo />
      </RouterLink>
      <AppearanceMenu />
    </header>

    <main class="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-12">
      <div class="flex flex-col gap-1">
        <h1 class="font-display text-3xl font-extrabold text-highlighted">
          {{ t('privacy.title') }}
        </h1>
        <p class="text-sm text-muted">
          {{ t('privacy.updated', { date: formatDate(PRIVACY_POLICY_DATE) }) }}
        </p>
      </div>

      <section
        v-for="section in PRIVACY_POLICY[language]"
        :key="section.title"
        class="flex flex-col gap-2 rounded-xl bg-default p-5 ring-2 ring-line"
      >
        <h2 class="font-display text-lg font-bold text-highlighted">{{ section.title }}</h2>
        <p v-for="paragraph in section.paragraphs" :key="paragraph" class="text-toned">
          {{ paragraph }}
        </p>
      </section>

      <UButton to="/" icon="i-lucide-arrow-left" class="self-start">
        {{ t('common.back') }}
      </UButton>
    </main>
  </div>
</template>

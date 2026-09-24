<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { LOCALES, type Locale } from '@kniho-hlod/domain';
import { setLocale } from '@/app/i18n';
import { useColorMode } from '@/composables/use-color-mode';

const LOCALE_LABELS: Record<Locale, string> = { cs: 'Čeština', en: 'English' };

const { t, locale } = useI18n();
const { isDark, toggle } = useColorMode();

const localeItems = computed(() =>
  LOCALES.map((code) => ({
    label: LOCALE_LABELS[code],
    icon: locale.value === code ? 'i-lucide-check' : undefined,
    onSelect: () => setLocale(code),
  }))
);
</script>

<template>
  <div class="flex items-center gap-1">
    <UButton
      :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
      :aria-label="isDark ? t('common.light') : t('common.dark')"
      color="neutral"
      variant="ghost"
      @click="toggle"
    />
    <UDropdownMenu :items="localeItems">
      <UButton
        icon="i-lucide-languages"
        :aria-label="t('common.language')"
        color="neutral"
        variant="ghost"
      />
    </UDropdownMenu>
  </div>
</template>

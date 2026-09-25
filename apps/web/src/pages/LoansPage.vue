<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import type { LoanListState } from '@/features/loans/api';
import LoanList from '@/features/loans/LoanList.vue';

const RETURNED_TAB: LoanListState = 'returned';
const ACTIVE_TAB: LoanListState = 'active';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

/** The open tab lives in the URL (`?tab=returned`), so going back returns to it. */
const tab = computed<LoanListState>({
  get: () => (route.query.tab === RETURNED_TAB ? RETURNED_TAB : ACTIVE_TAB),
  set: (value) => {
    void router.replace({ query: value === RETURNED_TAB ? { tab: RETURNED_TAB } : {} });
  },
});

const tabs = computed(() => [
  { label: t('loans.tabs.active'), value: ACTIVE_TAB, icon: 'i-lucide-book-up' },
  { label: t('loans.tabs.returned'), value: RETURNED_TAB, icon: 'i-lucide-book-check' },
]);
</script>

<template>
  <section class="flex flex-col gap-4">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-2xl font-semibold text-highlighted">{{ t('loans.title') }}</h1>
      <div class="flex gap-2">
        <UButton :to="{ name: 'contacts' }" icon="i-lucide-users" color="neutral" variant="subtle">
          {{ t('loans.contacts') }}
        </UButton>
        <UButton :to="{ name: 'loan-new' }" icon="i-lucide-hand-helping">
          {{ t('loans.lend') }}
        </UButton>
      </div>
    </header>

    <UTabs v-model="tab" :items="tabs" :content="false" class="w-full" />

    <LoanList :key="tab" :filters="{ state: tab }" :empty-text="t(`loans.empty.${tab}`)" />
  </section>
</template>

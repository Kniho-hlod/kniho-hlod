<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import BorrowedList from '@/features/lending/BorrowedList.vue';
import IncomingLoanRequests from '@/features/lending/IncomingLoanRequests.vue';
import type { LoanListState } from '@/features/loans/api';
import LoanList from '@/features/loans/LoanList.vue';
import { TOUR_TARGETS } from '@/features/onboarding/tour-steps';

const RETURNED_TAB: LoanListState = 'returned';
const ACTIVE_TAB: LoanListState = 'active';
/** The books the reader borrowed from friends, beside the books they lent. */
const BORROWED_TAB = 'borrowed';
type LoansTab = LoanListState | typeof BORROWED_TAB;
const OTHER_TABS: readonly LoansTab[] = [RETURNED_TAB, BORROWED_TAB];

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

/** The open tab lives in the URL (`?tab=returned`), so going back returns to it. */
const tab = computed<LoansTab>({
  get: () => OTHER_TABS.find((other) => other === route.query.tab) ?? ACTIVE_TAB,
  set: (value) => {
    void router.replace({ query: value === ACTIVE_TAB ? {} : { tab: value } });
  },
});
/** The lent-out tabs list the reader's own loans. */
const loanState = computed<LoanListState | null>(() =>
  tab.value === BORROWED_TAB ? null : tab.value
);

const tabs = computed(() => [
  { label: t('loans.tabs.active'), value: ACTIVE_TAB, icon: 'i-lucide-book-up' },
  { label: t('loans.tabs.returned'), value: RETURNED_TAB, icon: 'i-lucide-book-check' },
  { label: t('loans.tabs.borrowed'), value: BORROWED_TAB, icon: 'i-lucide-book-down' },
]);
</script>

<template>
  <section class="flex flex-col gap-4">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-3xl font-extrabold text-highlighted">{{ t('loans.title') }}</h1>
      <div class="flex gap-2">
        <UButton :to="{ name: 'contacts' }" icon="i-lucide-users" color="neutral" variant="subtle">
          {{ t('loans.contacts') }}
        </UButton>
        <UButton
          :to="{ name: 'loan-new' }"
          icon="i-lucide-hand-helping"
          :data-tour="TOUR_TARGETS.lend"
        >
          {{ t('loans.lend') }}
        </UButton>
      </div>
    </header>

    <IncomingLoanRequests />

    <!-- Three tabs fit a phone only as words: the icons wait for a wider screen. -->
    <UTabs
      v-model="tab"
      :items="tabs"
      :content="false"
      :ui="{ leadingIcon: 'max-sm:hidden' }"
      class="w-full"
      :data-tour="TOUR_TARGETS.borrow"
    />

    <LoanList
      v-if="loanState"
      :key="loanState"
      :filters="{ state: loanState }"
      :empty-text="t(`loans.empty.${loanState}`)"
    />
    <BorrowedList v-else />
  </section>
</template>

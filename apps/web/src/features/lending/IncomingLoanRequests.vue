<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLoanRequests } from './api';
import LoanRequestCard from './LoanRequestCard.vue';

/** Friends' requests for the reader's books, waiting for an answer; nothing when there are none. */
const { t } = useI18n();
const { data: requests } = useLoanRequests();
const incoming = computed(() => requests.value?.incoming ?? []);
</script>

<template>
  <section v-if="incoming.length > 0" class="flex flex-col gap-3">
    <h2 class="text-xl font-bold text-highlighted">{{ t('lending.requests.title') }}</h2>
    <ul class="grid gap-3 lg:grid-cols-2">
      <li v-for="request in incoming" :key="request.id">
        <LoanRequestCard :request="request" />
      </li>
    </ul>
  </section>
</template>

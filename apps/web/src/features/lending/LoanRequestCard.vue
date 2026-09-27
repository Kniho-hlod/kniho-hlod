<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import { addDays } from '@eleansphere/schema';
import { DEFAULT_LOAN_DAYS } from '@kniho-hlod/domain';
import type { LoanRequestItem } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { formatDate } from '@/app/dates';
import { describeError } from '@/app/errors';
import PersonAvatar from '@/components/PersonAvatar.vue';
import BookThumbnail from '@/features/books/BookThumbnail.vue';
import { useToday } from '@/features/loans/use-today';
import { useAcceptLoanRequest, useDeclineLoanRequest } from './api';

/**
 * A friend asking for one of the reader's books: who, which, their message and the date they
 * suggest. Lending asks for the due date first — the suggested one, or a month from today.
 */
const props = defineProps<{ request: LoanRequestItem }>();

const { t } = useI18n();
const toast = useToast();
const today = useToday();

const isChoosingDate = ref(false);
const dueAt = ref('');
const { mutateAsync: accept, isPending: isAccepting } = useAcceptLoanRequest();
const { mutateAsync: decline, isPending: isDeclining } = useDeclineLoanRequest();

const suggestion = computed(() =>
  props.request.dueAt
    ? t('lending.requests.suggests', { date: formatDate(props.request.dueAt) })
    : null
);

function chooseDate(): void {
  dueAt.value = props.request.dueAt ?? addDays(today.value, DEFAULT_LOAN_DAYS);
  isChoosingDate.value = true;
}

async function lend(): Promise<void> {
  try {
    await accept({ requestId: props.request.id, body: { dueAt: dueAt.value || null } });
    isChoosingDate.value = false;
    toast.add({
      title: t('lending.requests.lent', {
        title: props.request.book.title,
        name: props.request.person.displayName,
      }),
      color: 'success',
    });
  } catch (err) {
    toast.add({
      title: describeError(err, { conflict: t('lending.requests.alreadyLent') }),
      color: 'error',
    });
  }
}

async function refuse(): Promise<void> {
  try {
    await decline(props.request.id);
    toast.add({ title: t('lending.requests.declined'), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}
</script>

<template>
  <article class="flex gap-3 rounded-xl bg-default p-3 ring-2 ring-line">
    <BookThumbnail :url="fileUrl(request.book.cover)" :title="request.book.title" />
    <div class="flex min-w-0 flex-1 flex-col gap-2">
      <p class="flex items-center gap-2 text-sm text-default">
        <PersonAvatar
          :name="request.person.displayName"
          :src="fileUrl(request.person.avatar)"
          size="2xs"
        />
        <span class="min-w-0">
          {{ t('lending.requests.asks', { name: request.person.displayName }) }}
        </span>
      </p>
      <p class="font-display leading-tight font-bold text-highlighted">{{ request.book.title }}</p>
      <p
        v-if="request.message"
        class="rounded-lg bg-elevated px-3 py-2 text-sm whitespace-pre-line"
      >
        {{ request.message }}
      </p>
      <p v-if="suggestion" class="text-xs text-muted">{{ suggestion }}</p>

      <div v-if="isChoosingDate" class="flex flex-wrap items-end gap-2">
        <UFormField :label="t('lending.requests.dueAt')" name="dueAt">
          <UInput v-model="dueAt" type="date" :min="today" />
        </UFormField>
        <UButton icon="i-lucide-hand-helping" :loading="isAccepting" @click="lend">
          {{ t('lending.requests.lend') }}
        </UButton>
        <UButton color="neutral" variant="ghost" @click="isChoosingDate = false">
          {{ t('common.cancel') }}
        </UButton>
      </div>
      <div v-else class="flex flex-wrap gap-2">
        <UButton icon="i-lucide-hand-helping" size="sm" @click="chooseDate">
          {{ t('lending.requests.lend') }}
        </UButton>
        <UButton color="neutral" variant="outline" size="sm" :loading="isDeclining" @click="refuse">
          {{ t('lending.requests.decline') }}
        </UButton>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import type { LoanWithDetails } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { formatDate } from '@/app/dates';
import { describeError } from '@/app/errors';
import BookThumbnail from '@/features/books/BookThumbnail.vue';
import { useReturnLoan } from './api';
import { loanDue } from './loan-due';
import LoanDueChip from './LoanDueChip.vue';
import { useToday } from './use-today';

const props = defineProps<{
  loan: LoanWithDetails;
  /**
   * The page the card sits on, when that already names part of the loan: a book's page leaves
   * out the book, a contact's page the contact.
   */
  seenFrom?: 'book' | 'contact';
}>();

const { t } = useI18n();
const toast = useToast();
const today = useToday();

const due = computed(() => loanDue(props.loan, today.value));
const isOut = computed(() => due.value.status !== 'returned');

const dates = computed(() => {
  const { lentAt, dueAt, returnedAt } = props.loan;
  const lent = t('loans.lentOn', { date: formatDate(lentAt) });
  if (returnedAt) return `${lent} · ${t('loans.returnedOn', { date: formatDate(returnedAt) })}`;
  return `${lent} · ${dueAt ? t('loans.dueOn', { date: formatDate(dueAt) }) : t('loans.noDueDate')}`;
});

const { mutateAsync: returnLoan, isPending: isReturning } = useReturnLoan();

async function markReturned(): Promise<void> {
  try {
    await returnLoan(props.loan.id);
    toast.add({
      title: t('loans.returnedToast', { title: props.loan.book.title }),
      color: 'success',
    });
  } catch (err) {
    toast.add({
      title: describeError(err, { conflict: t('loans.alreadyReturned') }),
      color: 'error',
    });
  }
}
</script>

<template>
  <article class="flex gap-3 rounded-xl bg-default p-3 ring-2 ring-line">
    <RouterLink
      v-if="seenFrom !== 'book'"
      :to="{ name: 'book', params: { id: loan.book.id } }"
      tabindex="-1"
      aria-hidden="true"
      class="self-start transition-transform hover:-translate-y-1 motion-reduce:transition-none"
    >
      <BookThumbnail :url="fileUrl(loan.book.cover)" :title="loan.book.title" />
    </RouterLink>

    <div class="flex min-w-0 flex-1 flex-col gap-1.5">
      <RouterLink
        v-if="seenFrom !== 'book'"
        :to="{ name: 'book', params: { id: loan.book.id } }"
        class="line-clamp-2 font-display leading-tight font-bold text-highlighted hover:text-primary"
      >
        {{ loan.book.title }}
      </RouterLink>
      <RouterLink
        v-else
        :to="{ name: 'contact', params: { id: loan.contact.id } }"
        class="font-display font-bold text-highlighted hover:text-primary"
      >
        {{ loan.contact.name }}
      </RouterLink>

      <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <LoanDueChip :due="due" />
        <RouterLink
          v-if="seenFrom === undefined"
          :to="{ name: 'contact', params: { id: loan.contact.id } }"
          class="inline-flex min-w-0 items-center gap-1 text-sm font-medium text-default hover:text-primary"
          :aria-label="t('loans.lentTo', { name: loan.contact.name })"
        >
          <UIcon name="i-lucide-user-round" class="size-4 shrink-0 text-muted" />
          <span class="truncate">{{ loan.contact.name }}</span>
        </RouterLink>
      </div>

      <p class="text-xs text-muted">{{ dates }}</p>
      <p v-if="loan.note" class="line-clamp-2 text-sm text-muted">{{ loan.note }}</p>

      <div class="mt-1 flex flex-wrap items-center gap-2">
        <UButton
          v-if="isOut"
          size="sm"
          color="neutral"
          variant="outline"
          icon="i-lucide-undo-2"
          :loading="isReturning"
          :aria-label="t('loans.markReturnedLabel', { title: loan.book.title })"
          @click="markReturned"
        >
          {{ t('loans.markReturned') }}
        </UButton>
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-pencil"
          :to="{ name: 'loan-edit', params: { id: loan.id } }"
        >
          {{ t('common.edit') }}
        </UButton>
      </div>
    </div>
  </article>
</template>

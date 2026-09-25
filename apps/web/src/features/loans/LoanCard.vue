<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import { loanStatus } from '@kniho-hlod/domain';
import type { LoanWithDetails } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { formatDate } from '@/app/dates';
import { describeError } from '@/app/errors';
import BookThumbnail from '@/features/books/BookThumbnail.vue';
import { useReturnLoan } from './api';
import LoanStatusBadge from './LoanStatusBadge.vue';
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

const status = computed(() => loanStatus(props.loan, today.value));
const isOut = computed(() => status.value !== 'returned');

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
  <article class="flex gap-3 rounded-md p-3 ring ring-default">
    <RouterLink
      v-if="seenFrom !== 'book'"
      :to="{ name: 'book', params: { id: loan.book.id } }"
      tabindex="-1"
      aria-hidden="true"
    >
      <BookThumbnail :url="fileUrl(loan.book.cover)" :title="loan.book.title" />
    </RouterLink>

    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <RouterLink
          v-if="seenFrom !== 'book'"
          :to="{ name: 'book', params: { id: loan.book.id } }"
          class="line-clamp-2 font-medium text-highlighted hover:text-primary"
        >
          {{ loan.book.title }}
        </RouterLink>
        <RouterLink
          v-else
          :to="{ name: 'contact', params: { id: loan.contact.id } }"
          class="font-medium text-highlighted hover:text-primary"
        >
          {{ loan.contact.name }}
        </RouterLink>
        <LoanStatusBadge :status="status" />
      </div>

      <RouterLink
        v-if="seenFrom === undefined"
        :to="{ name: 'contact', params: { id: loan.contact.id } }"
        class="w-fit text-sm text-default hover:text-primary"
      >
        {{ t('loans.lentTo', { name: loan.contact.name }) }}
      </RouterLink>
      <p class="text-sm text-muted">{{ dates }}</p>
      <p v-if="loan.note" class="line-clamp-2 text-sm text-muted">{{ loan.note }}</p>

      <div class="mt-1 flex flex-wrap gap-2">
        <UButton
          v-if="isOut"
          size="sm"
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

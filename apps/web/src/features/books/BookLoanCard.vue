<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import type { BookWithDetails } from '@kniho-hlod/domain';
import { formatDate } from '@/app/dates';
import { describeError } from '@/app/errors';
import { useReturnLoan } from '@/features/loans/api';
import { loanDue } from '@/features/loans/loan-due';
import LoanDueChip from '@/features/loans/LoanDueChip.vue';
import { useToday } from '@/features/loans/use-today';

/** On a book's page: who has the book and until when, or that it is at home. */
const props = defineProps<{ book: BookWithDetails }>();

const { t } = useI18n();
const toast = useToast();
const today = useToday();

const loan = computed(() => props.book.activeLoan);
const due = computed(() => (loan.value ? loanDue(loan.value, today.value) : undefined));

const { mutateAsync: returnLoan, isPending: isReturning } = useReturnLoan();

async function markReturned(): Promise<void> {
  if (!loan.value) return;
  try {
    await returnLoan(loan.value.id);
    toast.add({ title: t('loans.returnedToast', { title: props.book.title }), color: 'success' });
  } catch (err) {
    toast.add({
      title: describeError(err, { conflict: t('loans.alreadyReturned') }),
      color: 'error',
    });
  }
}
</script>

<template>
  <UCard :ui="{ body: 'flex flex-col gap-2 p-4 sm:p-4' }">
    <template v-if="loan && due">
      <div class="flex flex-wrap items-center gap-2">
        <UIcon name="i-lucide-hand-helping" class="size-5 text-primary" />
        <RouterLink
          :to="{ name: 'contact', params: { id: loan.contact.id } }"
          class="font-display font-bold text-highlighted hover:text-primary"
        >
          {{ t('loans.lentTo', { name: loan.contact.name }) }}
        </RouterLink>
        <LoanDueChip :due="due" />
      </div>
      <p class="text-sm text-muted">
        {{ t('loans.lentOn', { date: formatDate(loan.lentAt) }) }} ·
        {{ loan.dueAt ? t('loans.dueOn', { date: formatDate(loan.dueAt) }) : t('loans.noDueDate') }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          icon="i-lucide-undo-2"
          :loading="isReturning"
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
          {{ t('loans.edit') }}
        </UButton>
      </div>
    </template>

    <div v-else class="flex flex-wrap items-center justify-between gap-2">
      <p class="flex items-center gap-2 text-muted">
        <UIcon name="i-lucide-house" class="size-5" />
        {{ t('books.atHome') }}
      </p>
      <UButton
        size="sm"
        icon="i-lucide-hand-helping"
        :to="{ name: 'loan-new', query: { bookId: book.id } }"
      >
        {{ t('books.lend') }}
      </UButton>
    </div>
  </UCard>
</template>

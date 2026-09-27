<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import type { LoanRequestItem } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { formatDate } from '@/app/dates';
import { describeError } from '@/app/errors';
import EmptyState from '@/components/EmptyState.vue';
import PersonAvatar from '@/components/PersonAvatar.vue';
import BookThumbnail from '@/features/books/BookThumbnail.vue';
import { loanDue } from '@/features/loans/loan-due';
import LoanDueChip from '@/features/loans/LoanDueChip.vue';
import { useToday } from '@/features/loans/use-today';
import { useBorrowed, useCancelLoanRequest, useLoanRequests } from './api';

/**
 * What the reader has borrowed from friends — whose, and when it is due back — and the requests
 * they sent that wait for an answer.
 */
withDefaults(defineProps<{ emptyText?: string }>(), { emptyText: undefined });

const { t } = useI18n();
const toast = useToast();
const today = useToday();
const { data: borrowed, isPending } = useBorrowed();
const { data: requests } = useLoanRequests();
const outgoing = computed(() => requests.value?.outgoing ?? []);
const { mutateAsync: cancel, isPending: isCancelling } = useCancelLoanRequest();

async function takeBack(request: LoanRequestItem): Promise<void> {
  try {
    await cancel(request.id);
    toast.add({ title: t('lending.outgoing.cancelled'), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <USkeleton v-if="isPending" class="h-24 w-full rounded-xl" />
    <EmptyState
      v-else-if="(borrowed ?? []).length === 0 && outgoing.length === 0"
      size="section"
      icon="i-lucide-book-down"
      :title="emptyText ?? t('lending.borrowed.empty')"
      :description="t('lending.borrowed.emptyHint')"
    />

    <ul v-if="(borrowed ?? []).length > 0" class="grid gap-3 lg:grid-cols-2">
      <li v-for="loan in borrowed" :key="loan.id">
        <article class="flex gap-3 rounded-xl bg-default p-3 ring-2 ring-line">
          <RouterLink
            :to="{ name: 'friend-book', params: { userId: loan.lender.id, bookId: loan.book.id } }"
            tabindex="-1"
            aria-hidden="true"
            class="self-start"
          >
            <BookThumbnail :url="fileUrl(loan.book.cover)" :title="loan.book.title" />
          </RouterLink>
          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <RouterLink
              :to="{
                name: 'friend-book',
                params: { userId: loan.lender.id, bookId: loan.book.id },
              }"
              class="line-clamp-2 font-display leading-tight font-bold text-highlighted hover:text-primary"
            >
              {{ loan.book.title }}
            </RouterLink>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <LoanDueChip :due="loanDue({ dueAt: loan.dueAt, returnedAt: null }, today)" />
              <span class="inline-flex min-w-0 items-center gap-1.5 text-sm text-default">
                <PersonAvatar
                  :name="loan.lender.displayName"
                  :src="fileUrl(loan.lender.avatar)"
                  size="3xs"
                />
                <span class="truncate">
                  {{ t('lending.borrowed.from', { name: loan.lender.displayName }) }}
                </span>
              </span>
            </div>
            <p class="text-xs text-muted">
              {{ t('loans.lentOn', { date: formatDate(loan.lentAt) }) }}
              <template v-if="loan.dueAt">
                · {{ t('loans.dueOn', { date: formatDate(loan.dueAt) }) }}
              </template>
            </p>
          </div>
        </article>
      </li>
    </ul>

    <section v-if="outgoing.length > 0" class="flex flex-col gap-2">
      <h3 class="text-sm font-bold tracking-wide text-muted uppercase">
        {{ t('lending.outgoing.title') }}
      </h3>
      <ul class="flex flex-col gap-2">
        <li
          v-for="request in outgoing"
          :key="request.id"
          class="flex flex-wrap items-center gap-3 rounded-xl bg-default p-3 ring-2 ring-line/15"
        >
          <PersonAvatar
            :name="request.person.displayName"
            :src="fileUrl(request.person.avatar)"
            size="sm"
          />
          <p class="min-w-0 flex-1 text-sm text-default">
            {{
              t('lending.outgoing.waiting', {
                title: request.book.title,
                name: request.person.displayName,
              })
            }}
          </p>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :loading="isCancelling"
            @click="takeBack(request)"
          >
            {{ t('lending.outgoing.cancel') }}
          </UButton>
        </li>
      </ul>
    </section>
  </div>
</template>

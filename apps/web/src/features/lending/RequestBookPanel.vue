<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import { addDays } from '@eleansphere/schema';
import { DEFAULT_LOAN_DAYS, loanRequestBodyFields } from '@kniho-hlod/domain';
import type { FriendBook } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import { formSchema, VALIDATE_ON } from '@/app/validation';
import { useToday } from '@/features/loans/use-today';
import { useCancelLoanRequest, useRequestBook } from './api';

/**
 * On a friend's book: ask to borrow it while it is at home, or see the request waiting and take
 * it back. A lent book shows only when it is due back (the page says so).
 */
const props = defineProps<{ book: FriendBook; friendId: string; friendName: string }>();

const { t } = useI18n();
const toast = useToast();
const today = useToday();

const isAsking = ref(false);
const schema = formSchema(loanRequestBodyFields, 'patch');
const state = reactive({ message: '', dueAt: '' });
const { mutateAsync: requestBook, isPending: isSending } = useRequestBook();
const { mutateAsync: cancelRequest, isPending: isCancelling } = useCancelLoanRequest();

function startAsking(): void {
  state.message = '';
  state.dueAt = addDays(today.value, DEFAULT_LOAN_DAYS);
  isAsking.value = true;
}

async function send(): Promise<void> {
  try {
    await requestBook({
      friendId: props.friendId,
      bookId: props.book.id,
      body: { message: state.message.trim() || null, dueAt: state.dueAt || null },
    });
    isAsking.value = false;
    toast.add({ title: t('lending.ask.sent', { name: props.friendName }), color: 'success' });
  } catch (err) {
    toast.add({
      title: describeError(err, { conflict: t('lending.ask.conflict') }),
      color: 'error',
    });
  }
}

async function takeBack(requestId: string): Promise<void> {
  try {
    await cancelRequest(requestId);
    toast.add({ title: t('lending.outgoing.cancelled'), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}
</script>

<template>
  <div v-if="!book.lent" class="flex flex-col gap-3">
    <div
      v-if="book.myRequest"
      class="flex flex-wrap items-center gap-3 rounded-xl bg-yellow-100 p-3 ring-2 ring-line dark:bg-yellow-300/10"
    >
      <UIcon name="i-lucide-hourglass" class="size-5 shrink-0 text-secondary" />
      <p class="min-w-0 flex-1 text-sm font-semibold text-highlighted">
        {{ t('lending.ask.waiting', { name: friendName }) }}
      </p>
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        :loading="isCancelling"
        @click="takeBack(book.myRequest.id)"
      >
        {{ t('lending.outgoing.cancel') }}
      </UButton>
    </div>

    <UButton
      v-else-if="!isAsking"
      icon="i-lucide-hand-helping"
      class="self-start"
      @click="startAsking"
    >
      {{ t('lending.ask.button') }}
    </UButton>

    <UForm
      v-else
      :schema="schema"
      :state="state"
      :validate-on="VALIDATE_ON"
      class="flex flex-col gap-3 rounded-xl bg-default p-4 ring-2 ring-line"
      @submit="send"
    >
      <h2 class="font-display text-lg font-bold text-highlighted">
        {{ t('lending.ask.title', { name: friendName }) }}
      </h2>
      <UFormField :label="t('lending.ask.message')" name="message">
        <UTextarea
          v-model="state.message"
          :rows="2"
          :placeholder="t('lending.ask.messagePlaceholder')"
          autoresize
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('lending.ask.dueAt')" :help="t('lending.ask.dueAtHint')" name="dueAt">
        <UInput v-model="state.dueAt" type="date" :min="today" />
      </UFormField>
      <div class="flex gap-2">
        <UButton type="submit" icon="i-lucide-send" :loading="isSending">
          {{ t('lending.ask.send') }}
        </UButton>
        <UButton color="neutral" variant="ghost" @click="isAsking = false">
          {{ t('common.cancel') }}
        </UButton>
      </div>
    </UForm>
  </div>
</template>

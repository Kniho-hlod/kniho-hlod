<script setup lang="ts">
import { computed, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import type { FriendWish } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import BookThumbnail from '@/features/books/BookThumbnail.vue';
import { useCancelGift, useFriendWishes, useGiveWish } from './api';

/**
 * A friend's wish list on their page: what they would like, whether the reader has a copy to
 * lend, and "Daruji" to promise a book as a gift — which the friend never sees, while the other
 * friends see that it is taken. Hidden while the list is empty.
 */
const props = defineProps<{ userId: string; friendName: string }>();

const { t } = useI18n();
const toast = useToast();

const userId = toRef(props, 'userId');
const { data: wishes } = useFriendWishes(userId);
const wishList = computed(() => wishes.value ?? []);

const { mutateAsync: give, isPending: isGiving, variables: giving } = useGiveWish();
const { mutateAsync: cancelGift, isPending: isCancelling, variables: cancelling } = useCancelGift();

async function promise(wish: FriendWish): Promise<void> {
  try {
    await give({ userId: props.userId, wishId: wish.id });
    toast.add({ title: t('wishes.friend.given', { title: wish.title }), color: 'success' });
  } catch (err) {
    toast.add({
      title: describeError(err, { conflict: t('wishes.friend.takenMeanwhile') }),
      color: 'error',
    });
  }
}

async function takeBack(wish: FriendWish): Promise<void> {
  try {
    await cancelGift({ userId: props.userId, wishId: wish.id });
    toast.add({ title: t('wishes.friend.cancelled'), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}
</script>

<template>
  <UCard v-if="wishList.length > 0">
    <template #header>
      <div class="flex flex-col gap-0.5">
        <h2 class="flex items-center gap-2 text-lg font-bold text-highlighted">
          <UIcon name="i-lucide-gift" class="size-5 text-primary" />
          {{ t('wishes.friend.title') }}
        </h2>
        <p class="text-sm text-muted">{{ t('wishes.friend.hint', { name: friendName }) }}</p>
      </div>
    </template>

    <ul class="flex flex-col divide-y-2 divide-line/10">
      <li
        v-for="wish in wishList"
        :key="wish.id"
        class="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0"
      >
        <BookThumbnail :url="undefined" :title="wish.title" />
        <div class="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
          <p class="font-bold break-words text-highlighted">{{ wish.title }}</p>
          <p v-if="wish.author" class="text-sm text-muted">{{ wish.author }}</p>
          <p v-if="wish.note" class="text-sm whitespace-pre-line text-toned">{{ wish.note }}</p>
          <UButton
            v-if="wish.myCopy"
            :to="{ name: 'book', params: { id: wish.myCopy.id } }"
            icon="i-lucide-library"
            color="success"
            variant="link"
            size="sm"
            class="self-start px-0"
          >
            {{ t('wishes.friend.youHaveIt') }}
          </UButton>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <template v-if="wish.gift === 'mine'">
            <UBadge color="primary" variant="subtle" icon="i-lucide-gift">
              {{ t('wishes.friend.youGive') }}
            </UBadge>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="isCancelling && cancelling?.wishId === wish.id"
              @click="takeBack(wish)"
            >
              {{ t('wishes.friend.cancel') }}
            </UButton>
          </template>
          <UBadge
            v-else-if="wish.gift === 'someoneElse'"
            color="neutral"
            variant="subtle"
            icon="i-lucide-check"
          >
            {{ t('wishes.friend.someoneGives') }}
          </UBadge>
          <UButton
            v-else
            icon="i-lucide-gift"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="isGiving && giving?.wishId === wish.id"
            @click="promise(wish)"
          >
            {{ t('wishes.friend.give') }}
          </UButton>
        </div>
      </li>
    </ul>
  </UCard>
</template>

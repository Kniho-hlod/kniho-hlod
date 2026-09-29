<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import type { RouteLocationRaw } from 'vue-router';
import type { NotificationItem, NotificationKind } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { formatDateTime } from '@/app/dates';
import PersonAvatar from '@/components/PersonAvatar.vue';
import { useMarkNotificationsRead, useNotifications } from './api';

/**
 * The bell in the header: how many notifications are unread, and the latest ones. Opening one
 * marks it read and goes where it is about.
 */
const { t } = useI18n();
const router = useRouter();
const { data: feed } = useNotifications();
const { mutate: markRead } = useMarkNotificationsRead();
const isOpen = ref(false);

const notifications = computed(() => feed.value?.data ?? []);
const unread = computed(() => feed.value?.unread ?? 0);

/** Where each kind of notification takes the reader. */
const DESTINATIONS: Record<NotificationKind, (item: NotificationItem) => RouteLocationRaw> = {
  friendRequest: () => ({ name: 'friends' }),
  friendAccepted: (item) => ({ name: 'friend', params: { userId: item.actor.id } }),
  loanRequest: () => ({ name: 'loans' }),
  loanRequestAccepted: () => ({ name: 'loans', query: { tab: 'borrowed' } }),
  loanRequestDeclined: (item) =>
    item.book
      ? { name: 'friend-book', params: { userId: item.actor.id, bookId: item.book.id } }
      : { name: 'friend', params: { userId: item.actor.id } },
  comment: (item) =>
    item.book ? { name: 'book', params: { id: item.book.id } } : { name: 'home' },
  // The recommendations wait on the home page, to take or set aside.
  recommendation: () => ({ name: 'home' }),
};

async function open(item: NotificationItem): Promise<void> {
  isOpen.value = false;
  if (!item.readAt) markRead([item.id]);
  await router.push(DESTINATIONS[item.kind](item));
}
</script>

<template>
  <UPopover v-model:open="isOpen" :content="{ align: 'end' }">
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-bell"
      class="relative rounded-full"
      :aria-label="
        unread > 0 ? t('notifications.bellUnread', { count: unread }) : t('notifications.bell')
      "
    >
      <span
        v-if="unread > 0"
        class="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-error px-1 text-center text-[0.625rem] leading-4 font-bold text-white ring-2 ring-paper"
      >
        {{ unread }}
      </span>
    </UButton>

    <template #content>
      <div class="flex w-80 max-w-[calc(100vw-2rem)] flex-col">
        <header class="flex items-center justify-between gap-2 border-b border-default px-4 py-3">
          <h2 class="font-display font-bold text-highlighted">{{ t('notifications.title') }}</h2>
          <UButton
            v-if="unread > 0"
            color="neutral"
            variant="link"
            size="xs"
            @click="markRead(undefined)"
          >
            {{ t('notifications.markAllRead') }}
          </UButton>
        </header>
        <p v-if="notifications.length === 0" class="px-4 py-6 text-center text-sm text-muted">
          {{ t('notifications.empty') }}
        </p>
        <ul v-else class="max-h-96 overflow-y-auto py-1">
          <li v-for="item in notifications" :key="item.id">
            <button
              type="button"
              class="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-elevated focus-visible:bg-elevated focus-visible:outline-none"
              @click="open(item)"
            >
              <PersonAvatar
                :name="item.actor.displayName"
                :src="fileUrl(item.actor.avatar)"
                size="sm"
              />
              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  class="text-sm"
                  :class="item.readAt ? 'text-toned' : 'font-semibold text-highlighted'"
                >
                  {{
                    t(`notifications.kinds.${item.kind}`, {
                      name: item.actor.displayName,
                      book: item.book?.title ?? '',
                    })
                  }}
                </span>
                <span class="text-xs text-muted">{{ formatDateTime(item.createdAt) }}</span>
              </span>
              <span
                v-if="!item.readAt"
                class="mt-1.5 size-2 shrink-0 rounded-full bg-secondary"
                :aria-label="t('notifications.unread')"
              />
            </button>
          </li>
        </ul>
      </div>
    </template>
  </UPopover>
</template>

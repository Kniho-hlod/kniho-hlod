<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import type { FriendRequest } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { formatDate } from '@/app/dates';
import { describeError } from '@/app/errors';
import EmptyState from '@/components/EmptyState.vue';
import PersonAvatar from '@/components/PersonAvatar.vue';
import { useSessionStore } from '@/features/auth/session-store';
import FeedList from '@/features/feed/FeedList.vue';
import {
  useAcceptFriendRequest,
  useFriendRequests,
  useFriends,
  useRemoveFriendRequest,
} from '@/features/friends/api';
import FriendCard from '@/features/friends/FriendCard.vue';
import InviteCard from '@/features/friends/InviteCard.vue';
import { TOUR_TARGETS } from '@/features/onboarding/tour-steps';

const SKELETON_COUNT = 3;
const FEED_TAB = 'feed';
const PEOPLE_TAB = 'people';
type FriendsTab = typeof FEED_TAB | typeof PEOPLE_TAB;
const TABS: readonly FriendsTab[] = [FEED_TAB, PEOPLE_TAB];

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const session = useSessionStore();

const { data: friends, error, isPending } = useFriends();

/**
 * The open tab lives in the URL (`?tab=people`), so going back returns to it. Without one, a
 * reader with friends sees what they read, and anyone else how to find some.
 */
const tab = computed<FriendsTab>({
  get: () =>
    TABS.find((other) => other === route.query.tab) ??
    ((friends.value ?? []).length > 0 ? FEED_TAB : PEOPLE_TAB),
  set: (value) => {
    void router.replace({ query: { tab: value } });
  },
});
const tabs = computed(() => [
  { label: t('feed.tab'), value: FEED_TAB, icon: 'i-lucide-newspaper' },
  { label: t('friends.listTitle'), value: PEOPLE_TAB, icon: 'i-lucide-users-round' },
]);
const { data: requests } = useFriendRequests();
const incoming = computed(() => requests.value?.incoming ?? []);
const outgoing = computed(() => requests.value?.outgoing ?? []);

const { mutateAsync: acceptRequest } = useAcceptFriendRequest();
const { mutateAsync: removeRequest } = useRemoveFriendRequest();
/** The request being answered, so only its buttons wait. */
const answering = ref<string | null>(null);

/** Runs an answer to a request, then says what happened. */
async function answerRequest(
  request: FriendRequest,
  action: (requestId: string) => Promise<unknown>,
  doneMessage: string
): Promise<void> {
  answering.value = request.id;
  try {
    await action(request.id);
    toast.add({ title: t(doneMessage, { name: request.person.displayName }), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    answering.value = null;
  }
}

const accept = (request: FriendRequest) =>
  answerRequest(request, acceptRequest, 'friends.requests.accepted');
const decline = (request: FriendRequest) =>
  answerRequest(request, removeRequest, 'friends.requests.declined');
const takeBack = (request: FriendRequest) =>
  answerRequest(request, removeRequest, 'friends.requests.takenBack');

const isSharing = computed(() => session.user?.shareLibrary ?? false);
const isStartingToShare = ref(false);

async function startSharing(): Promise<void> {
  isStartingToShare.value = true;
  try {
    await session.updateProfile({ shareLibrary: true });
    toast.add({ title: t('friends.sharing.saved.shareLibrary.true'), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    isStartingToShare.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <h1 class="text-3xl font-extrabold text-highlighted">{{ t('friends.title') }}</h1>

    <UAlert
      v-if="!isSharing"
      color="secondary"
      variant="subtle"
      icon="i-lucide-eye-off"
      :title="t('friends.sharing.offTitle')"
      :description="t('friends.sharing.offHint')"
      :actions="[
        {
          label: t('friends.sharing.turnOn'),
          loading: isStartingToShare,
          onClick: startSharing,
        },
      ]"
    />

    <section v-if="incoming.length > 0" class="flex flex-col gap-3">
      <h2 class="text-xl font-bold text-highlighted">{{ t('friends.requests.incoming') }}</h2>
      <ul class="flex flex-col gap-2">
        <li
          v-for="request in incoming"
          :key="request.id"
          class="flex flex-col gap-3 rounded-xl bg-default p-3 ring-2 ring-line sm:flex-row sm:items-center"
        >
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <PersonAvatar
              :name="request.person.displayName"
              :src="fileUrl(request.person.avatar)"
              size="md"
            />
            <div class="flex min-w-0 flex-1 flex-col">
              <p class="truncate font-semibold text-highlighted">
                {{ request.person.displayName }}
              </p>
              <p class="text-xs text-muted">
                {{
                  t('friends.requests.sentOn', { date: formatDate(request.sentAt.slice(0, 10)) })
                }}
              </p>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              icon="i-lucide-check"
              :loading="answering === request.id"
              @click="accept(request)"
            >
              {{ t('friends.requests.accept') }}
            </UButton>
            <UButton
              color="neutral"
              variant="outline"
              :disabled="answering === request.id"
              @click="decline(request)"
            >
              {{ t('friends.requests.decline') }}
            </UButton>
          </div>
        </li>
      </ul>
    </section>

    <UTabs v-model="tab" :items="tabs" :content="false" class="w-full" />

    <FeedList v-if="tab === FEED_TAB" />

    <section v-else class="flex flex-col gap-3" :data-tour="TOUR_TARGETS.comments">
      <h2 class="sr-only">{{ t('friends.listTitle') }}</h2>
      <UAlert v-if="error" color="error" variant="subtle" :description="describeError(error)" />
      <ul v-else-if="isPending" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="index in SKELETON_COUNT" :key="index">
          <USkeleton class="h-36 w-full rounded-xl" />
        </li>
      </ul>
      <EmptyState
        v-else-if="!friends || friends.length === 0"
        size="section"
        icon="i-lucide-users-round"
        :title="t('friends.emptyTitle')"
        :description="t('friends.empty')"
      />
      <ul v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="friend in friends" :key="friend.id">
          <FriendCard :friend="friend" />
        </li>
      </ul>
    </section>

    <InviteCard v-if="tab === PEOPLE_TAB" />

    <section v-if="tab === PEOPLE_TAB && outgoing.length > 0" class="flex flex-col gap-3">
      <h2 class="text-xl font-bold text-highlighted">{{ t('friends.requests.outgoing') }}</h2>
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
          <p class="min-w-0 flex-1 truncate text-sm text-default">
            {{ t('friends.requests.waiting', { name: request.person.displayName }) }}
          </p>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :loading="answering === request.id"
            @click="takeBack(request)"
          >
            {{ t('friends.requests.takeBack') }}
          </UButton>
        </li>
      </ul>
    </section>
  </section>
</template>

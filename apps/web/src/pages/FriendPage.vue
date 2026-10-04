<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import type { DropdownMenuItem } from '@nuxt/ui';
import { ApiError } from '@eleansphere/entity-core';
import { READING_STATUSES } from '@kniho-hlod/domain';
import type { ReadingStatus } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { formatDate } from '@/app/dates';
import { describeError } from '@/app/errors';
import EmptyState from '@/components/EmptyState.vue';
import PersonAvatar from '@/components/PersonAvatar.vue';
import {
  NO_FRIEND_BOOK_FILTERS,
  useFriend,
  useFriendBooks,
  useFriendShelves,
  useUnfriend,
} from '@/features/friends/api';
import type { FriendBookFilters } from '@/features/friends/api';
import FriendBookCard from '@/features/friends/FriendBookCard.vue';
import ShelfDot from '@/features/shelves/ShelfDot.vue';
import FriendWishes from '@/features/wishes/FriendWishes.vue';
import { useDebounced } from '@/shared/use-debounced';
import { useOnVisible } from '@/shared/use-on-visible';

const NOT_FOUND = 404;
const SKELETON_COUNT = 5;
/** The select value meaning "any reading status". */
const ANY_STATUS = 'any';

const props = defineProps<{ userId: string }>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const userId = toRef(props, 'userId');
const { data: friend, error, isPending } = useFriend(userId);
const isMissing = computed(
  () => error.value instanceof ApiError && error.value.status === NOT_FOUND
);
const sharesLibrary = computed(() => friend.value?.sharesLibrary ?? false);

/** The shelf lives in the address (`?shelf=`), as in the reader's own library. */
const shelfId = computed(() => (typeof route.query.shelf === 'string' ? route.query.shelf : null));
const search = ref('');
const debouncedSearch = useDebounced(search);
const statusChoice = ref<ReadingStatus | typeof ANY_STATUS>(ANY_STATUS);
const readingStatus = computed(() =>
  statusChoice.value === ANY_STATUS ? null : statusChoice.value
);
const filters = computed<FriendBookFilters>(() => ({
  ...NO_FRIEND_BOOK_FILTERS,
  q: debouncedSearch.value,
  readingStatus: readingStatus.value,
  shelfId: shelfId.value,
}));

const { data: shelves } = useFriendShelves(userId, sharesLibrary);
const {
  data: pages,
  isPending: isLoadingBooks,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
} = useFriendBooks(userId, filters, sharesLibrary);
const books = computed(() => pages.value?.pages.flatMap((page) => page.data) ?? []);
const total = computed(() => pages.value?.pages[0]?.total ?? 0);
const isFiltered = computed(
  () => search.value.trim() !== '' || readingStatus.value !== null || shelfId.value !== null
);

const readingStatusItems = computed(() => [
  { label: t('books.anyStatus'), value: ANY_STATUS },
  ...READING_STATUSES.map((status) => ({
    label: t(`friends.readingStatus.${status}`),
    value: status,
  })),
]);

function loadMore(): void {
  if (hasNextPage.value && !isFetchingNextPage.value) void fetchNextPage();
}
const listEnd = ref<HTMLElement | null>(null);
useOnVisible(listEnd, loadMore);

const TAB_CLASSES =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-2 transition-colors';
const ACTIVE_TAB_CLASSES = 'bg-yellow-300 text-ink-900 ring-line';
const IDLE_TAB_CLASSES = 'bg-default text-toned ring-line/15 hover:bg-elevated';

const isConfirmingUnfriend = ref(false);
const moreActions = computed<DropdownMenuItem[]>(() => [
  {
    label: t('friends.unfriend'),
    icon: 'i-lucide-user-minus',
    color: 'error',
    onSelect: () => {
      isConfirmingUnfriend.value = true;
    },
  },
]);
const { mutateAsync: unfriend, isPending: isUnfriending } = useUnfriend();

async function confirmUnfriend(): Promise<void> {
  try {
    await unfriend(props.userId);
    toast.add({
      title: t('friends.unfriended', { name: friend.value?.displayName ?? '' }),
      color: 'success',
    });
    await router.push({ name: 'friends' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    isConfirmingUnfriend.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-5">
    <UButton
      :to="{ name: 'friends' }"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="self-start"
    >
      {{ t('friends.title') }}
    </UButton>

    <USkeleton v-if="isPending && !error" class="h-20 w-full rounded-xl" />
    <EmptyState
      v-else-if="isMissing"
      icon="i-lucide-user-x"
      :title="t('friends.notFound')"
      :description="t('friends.notFoundHint')"
    />
    <UAlert v-else-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <template v-else-if="friend">
      <header class="flex items-center gap-4">
        <PersonAvatar :name="friend.displayName" :src="fileUrl(friend.avatar)" size="3xl" />
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 class="text-2xl font-extrabold break-words text-highlighted sm:text-3xl">
            {{ friend.displayName }}
          </h1>
          <p class="text-sm text-muted">
            {{ t('friends.since', { date: formatDate(friend.friendsSince.slice(0, 10)) }) }}
          </p>
        </div>
        <UDropdownMenu :items="moreActions" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis"
            color="neutral"
            variant="outline"
            :aria-label="t('common.moreActions')"
          />
        </UDropdownMenu>
      </header>

      <EmptyState
        v-if="!sharesLibrary"
        icon="i-lucide-book-lock"
        :title="t('friends.library.notShared', { name: friend.displayName })"
        :description="t('friends.library.notSharedHint')"
      />

      <template v-else>
        <FriendWishes :user-id="userId" :friend-name="friend.displayName" />

        <nav
          v-if="shelves && shelves.length > 0"
          :aria-label="t('shelves.title')"
          class="-mx-4 overflow-x-auto px-4"
        >
          <ul class="flex w-max items-center gap-2 py-1.5">
            <li>
              <RouterLink
                :to="{ name: 'friend', params: { userId } }"
                :class="[TAB_CLASSES, shelfId === null ? ACTIVE_TAB_CLASSES : IDLE_TAB_CLASSES]"
                :aria-current="shelfId === null ? 'page' : 'false'"
              >
                {{ t('shelves.allBooks') }}
              </RouterLink>
            </li>
            <li v-for="shelf in shelves" :key="shelf.id">
              <RouterLink
                :to="{ name: 'friend', params: { userId }, query: { shelf: shelf.id } }"
                :class="[TAB_CLASSES, shelfId === shelf.id ? ACTIVE_TAB_CLASSES : IDLE_TAB_CLASSES]"
                :aria-current="shelfId === shelf.id ? 'page' : 'false'"
              >
                <ShelfDot :color="shelf.color" />
                {{ shelf.name }}
              </RouterLink>
            </li>
          </ul>
        </nav>

        <div class="flex flex-wrap gap-2">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="t('friends.library.search')"
            :aria-label="t('friends.library.search')"
            class="min-w-0 flex-1 basis-60"
          />
          <USelect
            v-model="statusChoice"
            :items="readingStatusItems"
            :aria-label="t('books.fields.readingStatus')"
            class="w-48"
          />
        </div>

        <ul
          v-if="isLoadingBooks"
          class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5"
        >
          <li v-for="index in SKELETON_COUNT" :key="index" class="flex flex-col gap-2">
            <USkeleton class="aspect-[2/3] w-full rounded-lg" />
            <USkeleton class="h-4 w-3/4" />
          </li>
        </ul>
        <EmptyState
          v-else-if="books.length === 0"
          size="section"
          :icon="isFiltered ? 'i-lucide-search-x' : 'i-lucide-library'"
          :title="isFiltered ? t('books.emptyFiltered') : t('friends.library.empty')"
        />
        <template v-else>
          <p class="text-sm text-muted">{{ t('books.total', { count: total }) }}</p>
          <ul class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            <li v-for="book in books" :key="book.id">
              <FriendBookCard :book="book" :friend-id="userId" />
            </li>
          </ul>
          <div ref="listEnd" />
          <UButton
            v-if="hasNextPage"
            color="neutral"
            variant="subtle"
            block
            :loading="isFetchingNextPage"
            @click="loadMore"
          >
            {{ t('books.loadMore') }}
          </UButton>
        </template>
      </template>
    </template>

    <UModal
      v-model:open="isConfirmingUnfriend"
      :title="t('friends.unfriend')"
      :description="t('friends.unfriendConfirm', { name: friend?.displayName ?? '' })"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="isConfirmingUnfriend = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="isUnfriending" @click="confirmUnfriend">
            {{ t('friends.unfriend') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>

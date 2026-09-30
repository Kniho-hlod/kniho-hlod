<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import type { BookWithDetails, FriendCopy, IsbnLookupResult } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { formatDate } from '@/app/dates';
import PersonAvatar from '@/components/PersonAvatar.vue';
import { useFriendCopies } from '@/features/feed/api';
import ScannerViewfinder from '@/features/scanner/ScannerViewfinder.vue';
import { findBookByIsbn, useIsbnLookup } from './api';
import BookThumbnail from './BookThumbnail.vue';

/**
 * "Mám ji už?" — in a bookshop or a second-hand shop: scan a book's barcode and see at once
 * whether it is in the library already. A book that isn't can go straight into the form, and
 * friends who share a copy show up, those with it at home first, to borrow it from instead.
 */
type Check =
  | { phase: 'scanning' }
  | { phase: 'checking'; isbn: string }
  | { phase: 'owned'; isbn: string; book: BookWithDetails }
  /** `found` is what the catalogues say about the scanned book, when they know it. */
  | { phase: 'missing'; isbn: string; found: IsbnLookupResult | null }
  | { phase: 'failed'; isbn: string };

const open = defineModel<boolean>('open', { required: true });

const { t } = useI18n();
const router = useRouter();
const { mutateAsync: lookUp, isPending: isLookingUp } = useIsbnLookup();

const check = ref<Check>({ phase: 'scanning' });

// Every opening starts with the camera.
watch(open, (isOpen) => {
  if (isOpen) check.value = { phase: 'scanning' };
});

/** Friends are asked only about a book the reader doesn't have. */
const missingIsbn = computed(() => (check.value.phase === 'missing' ? check.value.isbn : null));
const { data: friendCopies } = useFriendCopies(missingIsbn);
const friendsWithCopy = computed(() =>
  [...(friendCopies.value ?? [])].sort((a, b) => Number(a.lent !== null) - Number(b.lent !== null))
);

function whereabouts(copy: FriendCopy): string {
  if (!copy.lent) return t('bookCheck.friendAtHome');
  return copy.lent.dueAt
    ? t('friends.library.lentUntil', { date: formatDate(copy.lent.dueAt) })
    : t('friends.library.lent');
}

/** The friend's copy, where the reader can ask to borrow it. */
async function openFriendCopy(copy: FriendCopy): Promise<void> {
  open.value = false;
  await router.push({
    name: 'friend-book',
    params: { userId: copy.friend.id, bookId: copy.bookId },
  });
}

async function describeMissing(isbn: string): Promise<void> {
  try {
    const found = await lookUp(isbn);
    // A newer scan may have replaced this one in the meantime.
    if (check.value.phase === 'missing' && check.value.isbn === isbn) {
      check.value = { phase: 'missing', isbn, found };
    }
  } catch {
    // Only a nicety: the reader still learns that the book isn't theirs.
  }
}

async function checkIsbn(isbn: string): Promise<void> {
  check.value = { phase: 'checking', isbn };
  try {
    const book = await findBookByIsbn(isbn);
    if (book) {
      check.value = { phase: 'owned', isbn, book };
      return;
    }
    check.value = { phase: 'missing', isbn, found: null };
    void describeMissing(isbn);
  } catch {
    check.value = { phase: 'failed', isbn };
  }
}

function scanAgain(): void {
  check.value = { phase: 'scanning' };
}

async function openOwnedBook(): Promise<void> {
  if (check.value.phase !== 'owned') return;
  const { book } = check.value;
  open.value = false;
  await router.push({ name: 'book', params: { id: book.id } });
}

/** The form looks the ISBN up as it opens (`?isbn=`). */
async function addMissingBook(): Promise<void> {
  if (check.value.phase !== 'missing') return;
  const { isbn } = check.value;
  open.value = false;
  await router.push({ name: 'book-new', query: { isbn } });
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('bookCheck.title')"
    :description="t('bookCheck.description')"
  >
    <template #body>
      <!-- Mounted only while scanning: the camera runs exactly that long. -->
      <ScannerViewfinder v-if="check.phase === 'scanning'" @detected="checkIsbn" />

      <div
        v-else-if="check.phase === 'checking'"
        class="flex items-center justify-center gap-2 py-8 text-muted"
      >
        <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
        {{ t('bookCheck.checking') }}
      </div>

      <div v-else class="flex flex-col gap-4">
        <UAlert
          v-if="check.phase === 'owned'"
          color="success"
          variant="subtle"
          icon="i-lucide-library"
          :title="t('bookCheck.owned')"
        />
        <UAlert
          v-else-if="check.phase === 'missing'"
          color="info"
          variant="subtle"
          icon="i-lucide-book-plus"
          :title="t('bookCheck.missing')"
        />
        <UAlert v-else color="error" variant="subtle" :title="t('bookCheck.failed')" />

        <div v-if="check.phase === 'owned'" class="flex items-center gap-3">
          <BookThumbnail :url="fileUrl(check.book.cover)" :title="check.book.title" />
          <div class="min-w-0">
            <p class="font-bold break-words text-highlighted">{{ check.book.title }}</p>
            <p v-if="check.book.author" class="text-sm text-toned">{{ check.book.author }}</p>
          </div>
        </div>
        <div v-else-if="check.phase === 'missing'" class="flex flex-col gap-0.5">
          <template v-if="check.found">
            <p class="font-bold break-words text-highlighted">{{ check.found.title }}</p>
            <p v-if="check.found.author" class="text-sm text-toned">{{ check.found.author }}</p>
          </template>
          <p v-else-if="isLookingUp" class="text-sm text-muted">{{ t('bookCheck.lookingUp') }}</p>
          <p class="text-sm text-muted">{{ t('bookCheck.isbn', { isbn: check.isbn }) }}</p>
        </div>

        <section
          v-if="check.phase === 'missing' && friendsWithCopy.length > 0"
          class="flex flex-col gap-2"
        >
          <h3 class="font-bold text-highlighted">{{ t('bookCheck.friendsHave') }}</h3>
          <ul class="flex flex-col gap-2">
            <li v-for="copy in friendsWithCopy" :key="copy.bookId">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-xl bg-default p-2 text-left ring-2 ring-line/15 hover:ring-line focus-visible:outline-2 focus-visible:outline-primary"
                @click="openFriendCopy(copy)"
              >
                <PersonAvatar
                  :name="copy.friend.displayName"
                  :src="fileUrl(copy.friend.avatar)"
                  size="sm"
                />
                <span class="min-w-0 flex-1 font-semibold break-words text-highlighted">
                  {{ copy.friend.displayName }}
                </span>
                <UBadge
                  :color="copy.lent ? 'neutral' : 'success'"
                  variant="subtle"
                  class="shrink-0"
                >
                  {{ whereabouts(copy) }}
                </UBadge>
              </button>
            </li>
          </ul>
        </section>

        <div class="flex flex-wrap gap-2">
          <UButton v-if="check.phase === 'owned'" icon="i-lucide-book-open" @click="openOwnedBook">
            {{ t('bookCheck.open') }}
          </UButton>
          <UButton
            v-else-if="check.phase === 'missing'"
            icon="i-lucide-plus"
            @click="addMissingBook"
          >
            {{ t('bookCheck.add') }}
          </UButton>
          <UButton
            icon="i-lucide-scan-barcode"
            color="neutral"
            variant="outline"
            @click="scanAgain"
          >
            {{ t('bookCheck.scanAgain') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

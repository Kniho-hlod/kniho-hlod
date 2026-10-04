<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import type { DropdownMenuItem } from '@nuxt/ui';
import type { Wish } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import EmptyState from '@/components/EmptyState.vue';
import { useSessionStore } from '@/features/auth/session-store';
import BookThumbnail from '@/features/books/BookThumbnail.vue';
import {
  emptyWishForm,
  useDeleteWish,
  useFulfilWish,
  useSaveWish,
  useWishes,
  wishToForm,
} from '@/features/wishes/api';
import type { WishFormState } from '@/features/wishes/api';
import WishForm from '@/features/wishes/WishForm.vue';

const SKELETON_COUNT = 3;

const { t } = useI18n();
const toast = useToast();
const router = useRouter();
const session = useSessionStore();

const sharesLibrary = computed(() => session.user?.shareLibrary ?? false);
const { data: wishes, error, isPending } = useWishes();
const wishList = computed(() => wishes.value ?? []);

const { mutateAsync: saveWish, isPending: isSaving } = useSaveWish();
const newWish = ref<WishFormState>(emptyWishForm());

async function addWish(): Promise<void> {
  try {
    await saveWish({ id: undefined, form: newWish.value });
    toast.add({
      title: t('wishes.added', { title: newWish.value.title.trim() }),
      color: 'success',
    });
    newWish.value = emptyWishForm();
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}

const editedWish = ref<Wish>();
const editForm = ref<WishFormState>(emptyWishForm());
const isEditing = computed({
  get: () => editedWish.value !== undefined,
  set: (open: boolean) => {
    if (!open) editedWish.value = undefined;
  },
});

function startEditing(wish: Wish): void {
  editForm.value = wishToForm(wish);
  editedWish.value = wish;
}

async function saveEdit(): Promise<void> {
  if (!editedWish.value) return;
  try {
    await saveWish({ id: editedWish.value.id, form: editForm.value });
    toast.add({ title: t('wishes.saved'), color: 'success' });
    editedWish.value = undefined;
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}

const { mutateAsync: fulfilWish, isPending: isFulfilling } = useFulfilWish();
const fulfilling = ref<string>();

async function fulfil(wish: Wish): Promise<void> {
  fulfilling.value = wish.id;
  try {
    const book = await fulfilWish(wish.id);
    toast.add({ title: t('wishes.fulfilled', { title: wish.title }), color: 'success' });
    await router.push({ name: 'book', params: { id: book.id } });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    fulfilling.value = undefined;
  }
}

const doomedWish = ref<Wish>();
const isConfirmingDelete = computed({
  get: () => doomedWish.value !== undefined,
  set: (open: boolean) => {
    if (!open) doomedWish.value = undefined;
  },
});
const { mutateAsync: deleteWish, isPending: isDeleting } = useDeleteWish();

async function confirmDelete(): Promise<void> {
  if (!doomedWish.value) return;
  try {
    await deleteWish(doomedWish.value.id);
    toast.add({ title: t('wishes.deleted'), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    doomedWish.value = undefined;
  }
}

function moreActions(wish: Wish): DropdownMenuItem[] {
  return [
    { label: t('common.edit'), icon: 'i-lucide-pencil', onSelect: () => startEditing(wish) },
    {
      label: t('common.delete'),
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => {
        doomedWish.value = wish;
      },
    },
  ];
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <UButton
      :to="{ name: 'books' }"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="self-start"
    >
      {{ t('books.title') }}
    </UButton>

    <header class="flex flex-col gap-1">
      <h1 class="text-3xl font-extrabold text-highlighted">{{ t('wishes.title') }}</h1>
      <p class="text-muted">{{ t('wishes.hint') }}</p>
    </header>

    <UAlert
      v-if="!sharesLibrary"
      color="warning"
      variant="subtle"
      icon="i-lucide-eye-off"
      :title="t('wishes.notSharedTitle')"
      :description="t('wishes.notSharedHint')"
      :actions="[
        {
          label: t('wishes.openSharing'),
          to: { name: 'account' },
          color: 'neutral',
          variant: 'outline',
        },
      ]"
    />

    <UCard>
      <template #header>
        <h2 class="text-lg font-bold text-highlighted">{{ t('wishes.addTitle') }}</h2>
      </template>
      <WishForm id="new-wish" v-model="newWish" @submit="addWish" />
      <template #footer>
        <div class="flex justify-end">
          <UButton type="submit" form="new-wish" icon="i-lucide-plus" :loading="isSaving">
            {{ t('wishes.add') }}
          </UButton>
        </div>
      </template>
    </UCard>

    <UAlert v-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <ul v-else-if="isPending" class="flex flex-col gap-2">
      <li v-for="index in SKELETON_COUNT" :key="index">
        <USkeleton class="h-20 w-full" />
      </li>
    </ul>

    <EmptyState
      v-else-if="wishList.length === 0"
      size="section"
      icon="i-lucide-gift"
      :title="t('wishes.emptyTitle')"
      :description="t('wishes.empty')"
    />

    <ul
      v-else
      class="flex flex-col divide-y-2 divide-line/10 rounded-xl bg-default ring-2 ring-line"
    >
      <li v-for="wish in wishList" :key="wish.id" class="flex items-start gap-3 p-3">
        <BookThumbnail :url="undefined" :title="wish.title" />
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <p class="font-bold break-words text-highlighted">{{ wish.title }}</p>
          <p v-if="wish.author" class="text-sm text-muted">{{ wish.author }}</p>
          <p v-if="wish.note" class="text-sm whitespace-pre-line text-toned">{{ wish.note }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <UButton
            icon="i-lucide-gift"
            color="primary"
            variant="outline"
            size="sm"
            :loading="isFulfilling && fulfilling === wish.id"
            @click="fulfil(wish)"
          >
            {{ t('wishes.fulfil') }}
          </UButton>
          <UDropdownMenu :items="moreActions(wish)" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-ellipsis"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="t('common.moreActions')"
            />
          </UDropdownMenu>
        </div>
      </li>
    </ul>

    <UModal v-model:open="isEditing" :title="t('wishes.editTitle')">
      <template #body>
        <WishForm id="edit-wish" v-model="editForm" @submit="saveEdit" />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="isEditing = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" form="edit-wish" icon="i-lucide-check" :loading="isSaving">
            {{ t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isConfirmingDelete"
      :title="t('wishes.deleteTitle')"
      :description="t('wishes.deleteConfirm', { title: doomedWish?.title ?? '' })"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="isConfirmingDelete = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="isDeleting" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>

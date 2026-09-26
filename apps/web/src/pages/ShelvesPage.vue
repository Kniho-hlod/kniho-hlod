<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import { DEFAULT_SHELF_COLOR, shelfFields } from '@kniho-hlod/domain';
import type { ShelfWithBooks } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import { pickFields } from '@/app/fields';
import { formSchema, VALIDATE_ON } from '@/app/validation';
import { useDeleteShelf, useMoveShelf, useSaveShelf, useShelves } from '@/features/shelves/api';
import type { ShelfFormState } from '@/features/shelves/api';
import ShelfColorPicker from '@/features/shelves/ShelfColorPicker.vue';
import ShelfDot from '@/features/shelves/ShelfDot.vue';

const SKELETON_COUNT = 3;
const UP = -1;
const DOWN = 1;

const { t } = useI18n();
const toast = useToast();

const { data: shelves, error, isPending } = useShelves();
const shelfList = computed(() => shelves.value ?? []);

const schema = formSchema(pickFields(shelfFields, ['name', 'color']), 'create');
const newShelf = reactive<ShelfFormState>({ name: '', color: DEFAULT_SHELF_COLOR });
const { mutateAsync: saveShelf, isPending: isSaving } = useSaveShelf();

async function addShelf(): Promise<void> {
  try {
    await saveShelf({ id: undefined, form: { ...newShelf } });
    toast.add({ title: t('shelves.created', { name: newShelf.name.trim() }), color: 'success' });
    Object.assign(newShelf, { name: '', color: DEFAULT_SHELF_COLOR });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}

const editedShelf = ref<ShelfWithBooks>();
const editForm = reactive<ShelfFormState>({ name: '', color: DEFAULT_SHELF_COLOR });
const isEditing = computed({
  get: () => editedShelf.value !== undefined,
  set: (open: boolean) => {
    if (!open) editedShelf.value = undefined;
  },
});

function startEditing(shelf: ShelfWithBooks): void {
  Object.assign(editForm, { name: shelf.name, color: shelf.color ?? DEFAULT_SHELF_COLOR });
  editedShelf.value = shelf;
}

async function saveEdit(): Promise<void> {
  if (!editedShelf.value) return;
  try {
    await saveShelf({ id: editedShelf.value.id, form: { ...editForm } });
    toast.add({ title: t('shelves.saved'), color: 'success' });
    editedShelf.value = undefined;
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}

const { mutate: moveShelf, isPending: isMoving } = useMoveShelf();

function move(index: number, direction: typeof UP | typeof DOWN): void {
  moveShelf(
    { shelves: shelfList.value, from: index, to: index + direction },
    { onError: (err) => toast.add({ title: describeError(err), color: 'error' }) }
  );
}

const doomedShelf = ref<ShelfWithBooks>();
const isConfirmingDelete = computed({
  get: () => doomedShelf.value !== undefined,
  set: (open: boolean) => {
    if (!open) doomedShelf.value = undefined;
  },
});
const { mutateAsync: deleteShelf, isPending: isDeleting } = useDeleteShelf();

async function confirmDelete(): Promise<void> {
  if (!doomedShelf.value) return;
  try {
    await deleteShelf(doomedShelf.value.id);
    toast.add({ title: t('shelves.deleted'), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    doomedShelf.value = undefined;
  }
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
      <h1 class="text-3xl font-extrabold text-highlighted">{{ t('shelves.title') }}</h1>
      <p class="text-muted">{{ t('shelves.hint') }}</p>
    </header>

    <UCard>
      <UForm
        :schema="schema"
        :state="newShelf"
        :validate-on="VALIDATE_ON"
        class="flex flex-col gap-4"
        @submit="addShelf"
      >
        <UFormField :label="t('shelves.fields.name')" name="name" required>
          <div class="flex gap-2">
            <UInput
              v-model="newShelf.name"
              :placeholder="t('shelves.namePlaceholder')"
              class="flex-1"
            />
            <UButton type="submit" icon="i-lucide-plus" :loading="isSaving">
              {{ t('shelves.add') }}
            </UButton>
          </div>
        </UFormField>
        <UFormField :label="t('shelves.fields.color')" name="color">
          <ShelfColorPicker v-model="newShelf.color" />
        </UFormField>
      </UForm>
    </UCard>

    <UAlert v-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <ul v-else-if="isPending" class="flex flex-col gap-2">
      <li v-for="index in SKELETON_COUNT" :key="index">
        <USkeleton class="h-14 w-full" />
      </li>
    </ul>

    <p v-else-if="shelfList.length === 0" class="text-muted">{{ t('shelves.empty') }}</p>

    <ul
      v-else
      class="flex flex-col divide-y-2 divide-line/10 rounded-xl bg-default ring-2 ring-line"
    >
      <li
        v-for="(shelf, index) in shelfList"
        :key="shelf.id"
        class="flex items-center gap-2 px-3 py-2"
      >
        <RouterLink
          :to="{ name: 'books', query: { shelf: shelf.id } }"
          class="flex min-w-0 flex-1 items-center gap-3 rounded py-1 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ShelfDot :color="shelf.color" />
          <span class="truncate font-medium text-highlighted">{{ shelf.name }}</span>
          <span class="shrink-0 text-sm text-muted">
            {{ t('shelves.bookCount', { count: shelf.bookCount }, shelf.bookCount) }}
          </span>
        </RouterLink>
        <div class="flex shrink-0 items-center">
          <UButton
            icon="i-lucide-arrow-up"
            :aria-label="t('shelves.moveUp', { name: shelf.name })"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="index === 0 || isMoving"
            @click="move(index, UP)"
          />
          <UButton
            icon="i-lucide-arrow-down"
            :aria-label="t('shelves.moveDown', { name: shelf.name })"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="index === shelfList.length - 1 || isMoving"
            @click="move(index, DOWN)"
          />
          <UButton
            icon="i-lucide-pencil"
            :aria-label="t('shelves.edit', { name: shelf.name })"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="startEditing(shelf)"
          />
          <UButton
            icon="i-lucide-trash-2"
            :aria-label="t('shelves.delete', { name: shelf.name })"
            color="error"
            variant="ghost"
            size="sm"
            @click="doomedShelf = shelf"
          />
        </div>
      </li>
    </ul>

    <UModal v-model:open="isEditing" :title="t('shelves.editTitle')">
      <template #body>
        <UForm
          id="edit-shelf"
          :schema="schema"
          :state="editForm"
          :validate-on="VALIDATE_ON"
          class="flex flex-col gap-4"
          @submit="saveEdit"
        >
          <UFormField :label="t('shelves.fields.name')" name="name" required>
            <UInput v-model="editForm.name" class="w-full" />
          </UFormField>
          <UFormField :label="t('shelves.fields.color')" name="color">
            <ShelfColorPicker v-model="editForm.color" />
          </UFormField>
        </UForm>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="isEditing = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" form="edit-shelf" icon="i-lucide-check" :loading="isSaving">
            {{ t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isConfirmingDelete"
      :title="t('shelves.deleteTitle')"
      :description="t('shelves.deleteConfirm', { name: doomedShelf?.name ?? '' })"
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

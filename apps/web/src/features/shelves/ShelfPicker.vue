<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import { DEFAULT_SHELF_COLOR } from '@kniho-hlod/domain';
import type { ShelfColor } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import { findShelfByName, useSaveShelf, useShelves } from './api';
import ShelfDot from './ShelfDot.vue';

interface ShelfItem {
  label: string;
  value: string;
  color: ShelfColor | undefined;
}

/** The ids of the shelves the book is on. */
const shelfIds = defineModel<string[]>({ required: true });

const { t } = useI18n();
const toast = useToast();

const { data: shelves, isPending } = useShelves();
const { mutateAsync: saveShelf, isPending: isCreating } = useSaveShelf();

const items = computed<ShelfItem[]>(() =>
  (shelves.value ?? []).map((shelf) => ({
    label: shelf.name,
    value: shelf.id,
    color: shelf.color,
  }))
);

function addShelfId(id: string): void {
  if (!shelfIds.value.includes(id)) shelfIds.value = [...shelfIds.value, id];
}

/** A typed name that is no shelf yet becomes one right away, and the book goes on it. */
async function createShelf(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = findShelfByName(shelves.value ?? [], trimmed);
  if (existing) {
    addShelfId(existing.id);
    return;
  }
  try {
    const created = await saveShelf({
      id: undefined,
      form: { name: trimmed, color: DEFAULT_SHELF_COLOR },
    });
    addShelfId(created.id);
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}
</script>

<template>
  <USelectMenu
    v-model="shelfIds"
    :items="items"
    value-key="value"
    multiple
    :loading="isPending || isCreating"
    :create-item="{ position: 'bottom', when: 'always' }"
    :search-input="{ placeholder: t('shelves.searchOrCreate'), icon: 'i-lucide-search' }"
    :placeholder="t('shelves.pick')"
    :aria-label="t('shelves.title')"
    icon="i-lucide-layers"
    class="w-full"
    @create="createShelf"
  >
    <template #item-leading="{ item }">
      <ShelfDot :color="item.color" />
    </template>
    <template #create-item-label="{ item }">
      {{ t('shelves.create', { name: item }) }}
    </template>
  </USelectMenu>
</template>

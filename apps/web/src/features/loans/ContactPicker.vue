<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useContactMatches } from '@/features/contacts/api';
import { useDebounced } from '@/shared/use-debounced';
import type { ContactChoice } from './loan-form';

interface ContactItem {
  label: string;
  value: string;
  description?: string;
}

/** The item standing for a name that isn't a contact yet; contact ids never look like this. */
const NEW_CONTACT_VALUE = 'new-contact';

const contact = defineModel<ContactChoice | null>({ required: true });

const { t } = useI18n();

const searchTerm = ref('');
const { data: matches, isFetching } = useContactMatches(useDebounced(searchTerm));

const matchingItems = computed<ContactItem[]>(() =>
  (matches.value?.data ?? []).map((match) => ({
    label: match.name,
    value: match.id,
    description: match.email ?? match.phone ?? undefined,
  }))
);

/** The matches, plus the current choice when the search has moved away from it. */
const items = computed<ContactItem[]>(() => {
  const chosen = contact.value;
  if (chosen?.kind === 'new') {
    return [
      { label: t('loans.newContact', { name: chosen.name }), value: NEW_CONTACT_VALUE },
      ...matchingItems.value,
    ];
  }
  if (chosen && !matchingItems.value.some((item) => item.value === chosen.id)) {
    return [{ label: chosen.name, value: chosen.id }, ...matchingItems.value];
  }
  return matchingItems.value;
});

const selectedValue = computed({
  get: () => {
    const chosen = contact.value;
    if (!chosen) return undefined;
    return chosen.kind === 'existing' ? chosen.id : NEW_CONTACT_VALUE;
  },
  set: (value: string | undefined) => {
    if (value === NEW_CONTACT_VALUE) return;
    const item = items.value.find((candidate) => candidate.value === value);
    contact.value = item ? { kind: 'existing', id: item.value, name: item.label } : null;
  },
});

function chooseNewName(name: string): void {
  const trimmed = name.trim();
  if (trimmed) contact.value = { kind: 'new', name: trimmed };
}
</script>

<template>
  <USelectMenu
    v-model="selectedValue"
    v-model:search-term="searchTerm"
    :items="items"
    value-key="value"
    ignore-filter
    :create-item="{ position: 'bottom', when: 'always' }"
    :search-input="{
      placeholder: t('loans.searchContacts'),
      icon: 'i-lucide-search',
      loading: isFetching,
    }"
    :placeholder="t('loans.pickContact')"
    :aria-label="t('loans.fields.contact')"
    icon="i-lucide-user-round"
    class="w-full"
    @create="chooseNewName"
  >
    <template #create-item-label="{ item }">
      {{ t('loans.newContact', { name: item }) }}
    </template>
  </USelectMenu>
</template>

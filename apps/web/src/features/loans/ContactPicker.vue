<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useContactMatches } from '@/features/contacts/api';
import { useFriends } from '@/features/friends/api';
import { useDebounced } from '@/shared/use-debounced';
import type { ContactChoice } from './loan-form';

interface ContactItem {
  label: string;
  value: string;
  description?: string;
  icon?: string;
}

/** The item standing for a name that isn't a contact yet; contact ids never look like this. */
const NEW_CONTACT_VALUE = 'new-contact';
/** Friends' items are `friend:<user id>`, apart from the contacts' own ids. */
const FRIEND_VALUE_PREFIX = 'friend:';
const FRIEND_ICON = 'i-lucide-users-round';

const contact = defineModel<ContactChoice | null>({ required: true });

const { t } = useI18n();

const searchTerm = ref('');
const debouncedSearch = useDebounced(searchTerm);
const { data: matches, isFetching } = useContactMatches(debouncedSearch);
const { data: friends } = useFriends();

/** Letter case and accents aside, so "tomas" finds "Tomáš". */
function folded(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

const matchingContacts = computed(() => matches.value?.data ?? []);

const contactItems = computed<ContactItem[]>(() =>
  matchingContacts.value.map((match) => ({
    label: match.name,
    value: match.id,
    description: match.email ?? match.phone ?? undefined,
    icon: match.linkedUserId ? FRIEND_ICON : undefined,
  }))
);

/**
 * Friends the search finds, unless their contact is listed already: lending to a friend goes to
 * the reader's contact for them, found or made on saving.
 */
const friendItems = computed<ContactItem[]>(() => {
  const listed = new Set(matchingContacts.value.map((match) => match.linkedUserId));
  const search = folded(debouncedSearch.value.trim());
  return (friends.value ?? [])
    .filter((friend) => !listed.has(friend.id) && folded(friend.displayName).includes(search))
    .map((friend) => ({
      label: friend.displayName,
      value: `${FRIEND_VALUE_PREFIX}${friend.id}`,
      description: t('loans.friendInApp'),
      icon: FRIEND_ICON,
    }));
});

const matchingItems = computed(() => [...contactItems.value, ...friendItems.value]);

function valueOf(choice: ContactChoice): string {
  if (choice.kind === 'existing') return choice.id;
  if (choice.kind === 'friend') return `${FRIEND_VALUE_PREFIX}${choice.friendId}`;
  return NEW_CONTACT_VALUE;
}

/** The matches, plus the current choice when the search has moved away from it. */
const items = computed<ContactItem[]>(() => {
  const chosen = contact.value;
  if (chosen?.kind === 'new') {
    return [
      { label: t('loans.newContact', { name: chosen.name }), value: NEW_CONTACT_VALUE },
      ...matchingItems.value,
    ];
  }
  if (chosen && !matchingItems.value.some((item) => item.value === valueOf(chosen))) {
    return [{ label: chosen.name, value: valueOf(chosen) }, ...matchingItems.value];
  }
  return matchingItems.value;
});

const selectedValue = computed({
  get: () => (contact.value ? valueOf(contact.value) : undefined),
  set: (value: string | undefined) => {
    if (value === NEW_CONTACT_VALUE) return;
    const item = items.value.find((candidate) => candidate.value === value);
    if (!item) {
      contact.value = null;
    } else if (item.value.startsWith(FRIEND_VALUE_PREFIX)) {
      const friendId = item.value.slice(FRIEND_VALUE_PREFIX.length);
      contact.value = { kind: 'friend', friendId, name: item.label };
    } else {
      contact.value = { kind: 'existing', id: item.value, name: item.label };
    }
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

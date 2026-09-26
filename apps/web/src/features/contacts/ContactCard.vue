<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ContactWithLoans } from '@kniho-hlod/domain';
import PersonAvatar from '@/components/PersonAvatar.vue';

defineProps<{ contact: ContactWithLoans }>();

const { t } = useI18n();
</script>

<template>
  <RouterLink
    :to="{ name: 'contact', params: { id: contact.id } }"
    class="group flex items-center gap-3 rounded-xl bg-default p-3 ring-2 ring-line transition-[translate,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  >
    <PersonAvatar :name="contact.name" size="md" />
    <div class="flex min-w-0 flex-1 flex-col">
      <p class="truncate font-display font-bold text-highlighted group-hover:text-primary">
        {{ contact.name }}
      </p>
      <p v-if="contact.email || contact.phone" class="truncate text-sm text-muted">
        {{ contact.email ?? contact.phone }}
      </p>
    </div>
    <UBadge
      v-if="contact.activeLoans > 0"
      color="neutral"
      variant="soft"
      icon="i-lucide-hand-helping"
      class="bg-sky-200 text-sky-950 dark:bg-sky-400/20 dark:text-sky-200"
    >
      {{ t('contacts.borrowing', { count: contact.activeLoans }) }}
    </UBadge>
  </RouterLink>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ContactWithLoans } from '@kniho-hlod/domain';

defineProps<{ contact: ContactWithLoans }>();

const { t } = useI18n();
</script>

<template>
  <RouterLink
    :to="{ name: 'contact', params: { id: contact.id } }"
    class="group flex items-center gap-3 rounded-md p-3 ring ring-default hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  >
    <UAvatar :alt="contact.name" size="md" />
    <div class="flex min-w-0 flex-1 flex-col">
      <p class="truncate font-medium text-highlighted group-hover:text-primary">
        {{ contact.name }}
      </p>
      <p v-if="contact.email || contact.phone" class="truncate text-sm text-muted">
        {{ contact.email ?? contact.phone }}
      </p>
    </div>
    <UBadge v-if="contact.activeLoans > 0" color="primary" variant="subtle">
      {{ t('contacts.borrowing', { count: contact.activeLoans }) }}
    </UBadge>
  </RouterLink>
</template>

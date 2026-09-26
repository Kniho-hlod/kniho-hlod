<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DropdownMenuItem } from '@nuxt/ui';
import { ADMIN_ROLE, DEFAULT_USER_ROLE } from '@kniho-hlod/domain';
import type { UserOverview, UserRole } from '@kniho-hlod/domain';
import { formatDay } from '@/app/dates';
import { useSessionStore } from '@/features/auth/session-store';

const props = defineProps<{ user: UserOverview }>();
const emit = defineEmits<{ 'change-role': [role: UserRole]; delete: [] }>();

const { t } = useI18n();
const session = useSessionStore();

/** Administrators manage their own account on the account page, never here. */
const isCurrentUser = computed(() => props.user.id === session.user?.id);
const isAdmin = computed(() => props.user.role === ADMIN_ROLE);

const actions = computed<DropdownMenuItem[]>(() => [
  isAdmin.value
    ? {
        label: t('admin.users.makeReader'),
        icon: 'i-lucide-shield-off',
        onSelect: () => emit('change-role', DEFAULT_USER_ROLE),
      }
    : {
        label: t('admin.users.makeAdmin'),
        icon: 'i-lucide-shield-check',
        onSelect: () => emit('change-role', ADMIN_ROLE),
      },
  {
    label: t('admin.users.delete'),
    icon: 'i-lucide-trash-2',
    color: 'error',
    onSelect: () => emit('delete'),
  },
]);
</script>

<template>
  <div class="flex items-center gap-3 rounded-md p-3 ring ring-default">
    <UAvatar :alt="user.displayName" size="md" />
    <div class="flex min-w-0 flex-1 flex-col">
      <p class="flex items-center gap-2">
        <span class="truncate font-medium text-highlighted">{{ user.displayName }}</span>
        <UBadge v-if="isAdmin" color="primary" variant="subtle" size="sm">
          {{ t('admin.users.admin') }}
        </UBadge>
        <UBadge v-if="isCurrentUser" color="neutral" variant="subtle" size="sm">
          {{ t('admin.users.you') }}
        </UBadge>
      </p>
      <p class="truncate text-sm text-muted">{{ user.email }}</p>
      <p class="text-xs text-dimmed">
        {{ t('admin.users.bookCount', user.bookCount) }} ·
        {{ t('admin.users.joined', { date: formatDay(user.createdAt) }) }}
      </p>
    </div>
    <UDropdownMenu v-if="!isCurrentUser" :items="actions">
      <UButton
        icon="i-lucide-ellipsis-vertical"
        :aria-label="t('admin.users.actions', { name: user.displayName })"
        color="neutral"
        variant="ghost"
      />
    </UDropdownMenu>
  </div>
</template>

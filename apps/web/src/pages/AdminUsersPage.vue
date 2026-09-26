<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import type { UserOverview, UserRole } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import { useDeleteUser, useSetUserRole, useUserList } from '@/features/admin/api';
import UserCard from '@/features/admin/UserCard.vue';
import { useDebounced } from '@/shared/use-debounced';
import { useOnVisible } from '@/shared/use-on-visible';

const SKELETON_COUNT = 5;

const { t } = useI18n();
const toast = useToast();

const search = ref('');
const debouncedSearch = useDebounced(search);
const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } =
  useUserList(debouncedSearch);

const users = computed(() => data.value?.pages.flatMap((page) => page.data) ?? []);
const isSearching = computed(() => debouncedSearch.value.trim() !== '');

function loadMore(): void {
  if (hasNextPage.value && !isFetchingNextPage.value) void fetchNextPage();
}

const listEnd = ref<HTMLElement | null>(null);
useOnVisible(listEnd, loadMore);

const { mutateAsync: setRole } = useSetUserRole();

async function changeRole(user: UserOverview, role: UserRole): Promise<void> {
  try {
    await setRole({ user, role });
    toast.add({
      title: t(`admin.users.roleChanged.${role}`, { name: user.displayName }),
      color: 'success',
    });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}

/** The account waiting for the administrator to confirm its deletion. */
const accountToDelete = ref<UserOverview>();
const isConfirmingDelete = computed({
  get: () => accountToDelete.value !== undefined,
  set: (open) => {
    if (!open) accountToDelete.value = undefined;
  },
});
const { mutateAsync: deleteUser, isPending: isDeleting } = useDeleteUser();

async function confirmDelete(): Promise<void> {
  const user = accountToDelete.value;
  if (!user) return;
  try {
    await deleteUser(user);
    toast.add({ title: t('admin.users.deleted', { name: user.displayName }), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    accountToDelete.value = undefined;
  }
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <UButton
      :to="{ name: 'admin' }"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="self-start"
    >
      {{ t('admin.title') }}
    </UButton>

    <h1 class="text-2xl font-semibold text-highlighted">{{ t('admin.users.title') }}</h1>

    <UInput
      v-model="search"
      type="search"
      icon="i-lucide-search"
      :placeholder="t('admin.users.search')"
      :aria-label="t('admin.users.search')"
    />

    <UAlert v-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <ul v-else-if="isPending" class="flex flex-col gap-2">
      <li v-for="index in SKELETON_COUNT" :key="index"><USkeleton class="h-20 w-full" /></li>
    </ul>

    <p v-else-if="users.length === 0" class="text-muted">
      {{ isSearching ? t('admin.users.emptyFiltered') : t('admin.users.empty') }}
    </p>

    <template v-else>
      <ul class="flex flex-col gap-2">
        <li v-for="user in users" :key="user.id">
          <UserCard
            :user="user"
            @change-role="(role) => changeRole(user, role)"
            @delete="accountToDelete = user"
          />
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
        {{ t('common.loadMore') }}
      </UButton>
    </template>

    <UModal
      v-model:open="isConfirmingDelete"
      :title="t('admin.users.delete')"
      :description="
        t('admin.users.deleteConfirm', {
          name: accountToDelete?.displayName ?? '',
          email: accountToDelete?.email ?? '',
        })
      "
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="isConfirmingDelete = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="isDeleting" @click="confirmDelete">
            {{ t('admin.users.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>

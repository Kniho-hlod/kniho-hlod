<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import type { DropdownMenuItem } from '@nuxt/ui';
import { LOCALES } from '@kniho-hlod/domain';
import { LOCALE_LABELS, setLocale } from '@/app/i18n';
import PersonAvatar from '@/components/PersonAvatar.vue';
import { useColorMode } from '@/composables/use-color-mode';
import { useAvatar } from '@/features/account/use-avatar';
import { useSessionStore } from '@/features/auth/session-store';

const { t, locale } = useI18n();
const router = useRouter();
const session = useSessionStore();
const { avatarUrl } = useAvatar();
const { isDark, toggle } = useColorMode();

async function signOut(): Promise<void> {
  await session.signOut();
  await router.push({ name: 'sign-in' });
}

/** Everything about the reader rather than their library: who they are, the look, signing out. */
const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      type: 'label',
      label: session.user?.displayName,
      description: session.user?.email,
      avatar: { src: avatarUrl.value, alt: session.user?.displayName },
    },
  ],
  [
    {
      label: t('nav.account'),
      icon: 'i-lucide-user-round',
      to: { name: 'account' },
    },
    {
      label: isDark.value ? t('common.light') : t('common.dark'),
      icon: isDark.value ? 'i-lucide-sun' : 'i-lucide-moon',
      onSelect: (event: Event) => {
        // The menu stays open, so the reader sees the change and can take it back.
        event.preventDefault();
        toggle();
      },
    },
    {
      label: t('common.language'),
      icon: 'i-lucide-languages',
      children: LOCALES.map((code) => ({
        label: LOCALE_LABELS[code],
        icon: locale.value === code ? 'i-lucide-check' : undefined,
        onSelect: () => setLocale(code),
      })),
    },
  ],
  [
    {
      label: t('nav.signOut'),
      icon: 'i-lucide-log-out',
      color: 'error',
      onSelect: signOut,
    },
  ],
]);
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }" :ui="{ content: 'w-60' }">
    <UButton
      color="neutral"
      variant="ghost"
      class="rounded-full p-0.5"
      :aria-label="t('nav.accountMenu')"
    >
      <PersonAvatar :name="session.user?.displayName ?? ''" :src="avatarUrl" size="md" />
    </UButton>
  </UDropdownMenu>
</template>

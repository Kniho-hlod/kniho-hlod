<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import type { DropdownMenuItem } from '@nuxt/ui';
import { LOCALES } from '@kniho-hlod/domain';
import { LOCALE_LABELS, setLocale } from '@/app/i18n';
import PersonAvatar from '@/components/PersonAvatar.vue';
import { useColorMode } from '@/composables/use-color-mode';
import { useAvatar } from '@/features/account/use-avatar';
import { useSessionStore } from '@/features/auth/session-store';
import FeedbackModal from '@/features/feedback/FeedbackModal.vue';
import { TOUR_TARGETS } from '@/features/onboarding/tour-steps';
import { useOnboardingTour } from '@/features/onboarding/use-onboarding-tour';

const { t, locale } = useI18n();
const router = useRouter();
const session = useSessionStore();
const { avatarUrl } = useAvatar();
const { isDark, toggle } = useColorMode();
const isReporting = ref(false);
const tour = useOnboardingTour();

async function signOut(): Promise<void> {
  await session.signOut();
  await router.push({ name: 'sign-in' });
}

/**
 * Everything about the reader rather than their library: who they are, the look, the tour again,
 * a word to the administrators, signing out.
 */
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
      label: t('nav.tour'),
      icon: 'i-lucide-signpost',
      onSelect: () => tour.welcome(),
    },
    {
      label: t('nav.feedback'),
      icon: 'i-lucide-message-square-warning',
      onSelect: () => {
        isReporting.value = true;
      },
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
      class="rounded-full p-0.5 transition-shadow hover:shadow-pop-sm data-[state=open]:shadow-pop-sm"
      :aria-label="t('nav.accountMenu')"
      :data-tour="TOUR_TARGETS.accountMenu"
    >
      <PersonAvatar :name="session.user?.displayName ?? ''" :src="avatarUrl" size="md" />
    </UButton>
  </UDropdownMenu>
  <FeedbackModal v-model:open="isReporting" />
</template>

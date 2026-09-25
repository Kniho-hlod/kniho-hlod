<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useSessionStore } from '@/features/auth/session-store';
import AppearanceMenu from '@/components/AppearanceMenu.vue';
import SystemNotificationBanner from '@/components/SystemNotificationBanner.vue';

const { t } = useI18n();
const router = useRouter();
const session = useSessionStore();

/**
 * When an item is highlighted: `exact` only on its own page — every signed-in page sits under
 * home's `/`, so a looser match would light it up everywhere; `section` on its page and the pages
 * below it (a book's detail belongs to Books).
 */
type NavigationMatch = 'exact' | 'section';

const ACTIVE_CLASS = 'text-primary';

/**
 * `RouterLink` keys its classes by name — `{ [activeClass]: isActive, [exactActiveClass]:
 * isExactActive }` — so the same class for both states lets the exact one overwrite the other.
 * Each item therefore highlights through exactly one of them.
 */
function highlightClasses(match: NavigationMatch) {
  return match === 'exact'
    ? { activeClass: '', exactActiveClass: ACTIVE_CLASS }
    : { activeClass: ACTIVE_CLASS, exactActiveClass: '' };
}

/** Loans join this list in the next phase. */
const navigation = computed(() => [
  {
    label: t('nav.home'),
    icon: 'i-lucide-house',
    to: { name: 'home' },
    match: 'exact' as NavigationMatch,
  },
  {
    label: t('nav.books'),
    icon: 'i-lucide-library',
    to: { name: 'books' },
    match: 'section' as NavigationMatch,
  },
  {
    label: t('nav.account'),
    icon: 'i-lucide-user-round',
    to: { name: 'account' },
    match: 'section' as NavigationMatch,
  },
]);

async function signOut(): Promise<void> {
  await session.signOut();
  await router.push({ name: 'sign-in' });
}
</script>

<template>
  <div class="min-h-dvh bg-default">
    <header
      class="sticky top-0 z-10 border-b border-default bg-default/80 backdrop-blur px-4 h-16 flex items-center justify-between gap-4"
    >
      <RouterLink
        :to="{ name: 'home' }"
        class="flex items-center gap-2 font-semibold text-highlighted"
      >
        <UIcon name="i-lucide-library-big" class="size-6 text-primary" />
        <span>{{ t('app.name') }}</span>
      </RouterLink>

      <nav class="hidden lg:flex items-center gap-1">
        <UButton
          v-for="item in navigation"
          :key="item.label"
          :to="item.to"
          :icon="item.icon"
          :label="item.label"
          :exact="item.match === 'exact'"
          color="neutral"
          variant="ghost"
          active-color="primary"
          active-variant="soft"
        />
      </nav>

      <div class="flex items-center gap-1">
        <AppearanceMenu />
        <UButton
          icon="i-lucide-log-out"
          :aria-label="t('nav.signOut')"
          color="neutral"
          variant="ghost"
          @click="signOut"
        />
      </div>
    </header>

    <main class="app-content mx-auto w-full max-w-4xl px-4 py-6 flex flex-col gap-4">
      <SystemNotificationBanner />
      <RouterView />
    </main>

    <nav
      class="lg:hidden fixed bottom-0 inset-x-0 border-t border-default bg-default/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul class="flex">
        <li v-for="item in navigation" :key="item.label" class="flex-1">
          <RouterLink
            :to="item.to"
            class="flex flex-col items-center gap-1 py-3 text-xs text-muted"
            v-bind="highlightClasses(item.match)"
          >
            <UIcon :name="item.icon" class="size-5" />
            {{ item.label }}
          </RouterLink>
        </li>
      </ul>
    </nav>
  </div>
</template>

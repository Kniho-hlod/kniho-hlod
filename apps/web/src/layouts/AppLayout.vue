<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RouteLocationRaw } from 'vue-router';
import { ADMIN_ROLE } from '@kniho-hlod/domain';
import { useSessionStore } from '@/features/auth/session-store';
import { useLibraryStats } from '@/features/loans/api';
import AccountMenu from '@/components/AccountMenu.vue';
import AppLogo from '@/components/AppLogo.vue';
import NavLink, { type NavigationMatch } from '@/components/NavLink.vue';
import SystemNotificationBanner from '@/components/SystemNotificationBanner.vue';

const { t } = useI18n();
const session = useSessionStore();
const { data: stats } = useLibraryStats();

interface NavigationItem {
  label: string;
  icon: string;
  to: RouteLocationRaw;
  match: NavigationMatch;
  /** A count to call out next to the item — overdue loans; none when 0. */
  alertCount?: number;
}

const navigation = computed<NavigationItem[]>(() => [
  {
    label: t('nav.home'),
    icon: 'i-lucide-house',
    to: { name: 'home' },
    match: 'exact',
  },
  {
    label: t('nav.books'),
    icon: 'i-lucide-library',
    to: { name: 'books' },
    match: 'section',
  },
  {
    label: t('nav.loans'),
    icon: 'i-lucide-hand-helping',
    to: { name: 'loans' },
    match: 'section',
    alertCount: stats.value?.overdue ?? 0,
  },
  {
    label: t('nav.account'),
    icon: 'i-lucide-user-round',
    to: { name: 'account' },
    match: 'section',
  },
  ...(session.user?.role === ADMIN_ROLE ? [administrationItem()] : []),
]);

/** Only administrators see it. */
function administrationItem(): NavigationItem {
  return {
    label: t('nav.admin'),
    icon: 'i-lucide-shield',
    to: { name: 'admin' },
    match: 'section',
  };
}
</script>

<template>
  <div class="min-h-dvh bg-paper">
    <header
      class="sticky top-0 z-10 border-b-2 border-line/10 bg-paper/85 backdrop-blur px-4 h-16 flex items-center justify-between gap-4"
    >
      <RouterLink :to="{ name: 'home' }" class="rounded-lg">
        <AppLogo />
      </RouterLink>

      <nav class="hidden lg:flex items-center gap-1.5" :aria-label="t('nav.main')">
        <NavLink
          v-for="item in navigation"
          :key="item.label"
          :to="item.to"
          :match="item.match"
          class="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold text-toned transition-colors not-data-active:hover:bg-elevated not-data-active:hover:text-highlighted data-active:bg-yellow-300 data-active:text-ink-900 data-active:ring-2 data-active:ring-line"
        >
          <UIcon :name="item.icon" class="size-4" />
          {{ item.label }}
          <span
            v-if="item.alertCount"
            class="min-w-5 rounded-full bg-error px-1.5 text-center text-xs leading-5 font-bold text-white"
          >
            {{ item.alertCount }}
          </span>
        </NavLink>
      </nav>

      <AccountMenu />
    </header>

    <main class="app-content mx-auto w-full max-w-5xl px-4 py-6 flex flex-col gap-5">
      <SystemNotificationBanner />
      <RouterView />
    </main>

    <nav
      class="lg:hidden fixed bottom-0 inset-x-0 z-10 border-t-2 border-line/10 bg-paper/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      :aria-label="t('nav.main')"
    >
      <ul class="flex">
        <li v-for="item in navigation" :key="item.label" class="flex-1">
          <NavLink
            :to="item.to"
            :match="item.match"
            class="group flex flex-col items-center gap-1 pt-2 pb-2.5 text-xs font-medium text-muted data-active:font-bold data-active:text-highlighted"
          >
            <span
              class="relative grid h-8 w-14 place-items-center rounded-full transition-colors group-data-active:bg-yellow-300 group-data-active:text-ink-900 group-data-active:ring-2 group-data-active:ring-line"
            >
              <UIcon :name="item.icon" class="size-5" />
              <span
                v-if="item.alertCount"
                class="absolute -top-1 right-1.5 min-w-4 rounded-full bg-error px-1 text-center text-[0.625rem] leading-4 font-bold text-white ring-2 ring-paper"
              >
                {{ item.alertCount }}
              </span>
            </span>
            {{ item.label }}
          </NavLink>
        </li>
      </ul>
    </nav>
  </div>
</template>

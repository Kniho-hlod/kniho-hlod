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

/** Books and loans join this list in the next phases. */
const navigation = computed(() => [
  { label: t('nav.home'), icon: 'i-lucide-house', to: { name: 'home' } },
  { label: t('nav.account'), icon: 'i-lucide-user-round', to: { name: 'account' } },
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
      <RouterLink :to="{ name: 'home' }" class="flex items-center gap-2 font-semibold text-highlighted">
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
          color="neutral"
          variant="ghost"
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
            active-class="text-primary"
          >
            <UIcon :name="item.icon" class="size-5" />
            {{ item.label }}
          </RouterLink>
        </li>
      </ul>
    </nav>
  </div>
</template>

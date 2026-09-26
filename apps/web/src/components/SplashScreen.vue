<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AppLogo from '@/components/AppLogo.vue';
import splashImageUrl from '@/assets/splash.webp';

/** How long each joke stays up: long enough to read, short enough that a slow start shows several. */
const LINE_INTERVAL_MS = 1100;

const { t, tm, rt } = useI18n();

const lines = computed(() => (tm('splash.lines') as string[]).map((line) => rt(line)));
// Every start opens with a different joke.
const lineIndex = ref(Math.floor(Math.random() * lines.value.length));
const line = computed(() => lines.value[lineIndex.value % lines.value.length]);

const lineTimer = setInterval(() => lineIndex.value++, LINE_INTERVAL_MS);
onBeforeUnmount(() => clearInterval(lineTimer));
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-ink-900 bg-cover bg-center p-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))]"
    :style="{ backgroundImage: `url(${splashImageUrl})` }"
  >
    <div class="w-full max-w-sm rounded-xl bg-default p-5 shadow-pop ring-2 ring-line">
      <AppLogo />
      <p role="status" class="sr-only">{{ t('splash.loading') }}</p>
      <!-- The jokes are for the eyes; a screen reader hears the status above, once. -->
      <div aria-hidden="true" class="mt-4 min-h-14">
        <Transition
          mode="out-in"
          enter-active-class="transition duration-200 motion-reduce:transition-none"
          enter-from-class="translate-y-1 opacity-0"
          leave-active-class="transition duration-150 motion-reduce:transition-none"
          leave-to-class="-translate-y-1 opacity-0"
        >
          <p :key="line" class="font-display text-xl font-bold text-highlighted">{{ line }}</p>
        </Transition>
      </div>
      <UProgress animation="swing" class="mt-3" />
    </div>
  </div>
</template>

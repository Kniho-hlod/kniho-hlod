<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

/** A password field whose eye button shows what was typed. `focus`/`blur` reach the input. */
defineProps<{ autocomplete: 'current-password' | 'new-password' }>();
const password = defineModel<string>({ required: true });

const { t } = useI18n();
const isVisible = ref(false);
</script>

<template>
  <UInput
    v-model="password"
    :type="isVisible ? 'text' : 'password'"
    :autocomplete="autocomplete"
    :ui="{ trailing: 'pe-1' }"
    class="w-full"
  >
    <template #trailing>
      <UButton
        color="neutral"
        variant="link"
        size="sm"
        :icon="isVisible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
        :aria-label="isVisible ? t('auth.hidePassword') : t('auth.showPassword')"
        :aria-pressed="isVisible"
        @click="isVisible = !isVisible"
      />
    </template>
  </UInput>
</template>

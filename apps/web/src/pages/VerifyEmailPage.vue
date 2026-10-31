<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { ApiError } from '@eleansphere/entity-core';
import { describeError } from '@/app/errors';
import PeekingBookworm from '@/components/PeekingBookworm.vue';
import { useSessionStore } from '@/features/auth/session-store';

const BAD_REQUEST = 400;

/**
 * Where the e-mailed link lands: confirms the address at once, signed in or not (the link may be
 * opened on another device). An invalid or expired link says so; signed in, the banner over the
 * app's pages sends a new one.
 */
const { t } = useI18n();
const route = useRoute();
const session = useSessionStore();

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));
const verifiedEmail = ref('');
const errorMessage = ref('');
const isChecking = ref(true);

onMounted(async () => {
  if (!token.value) {
    errorMessage.value = t('auth.verifyEmail.invalid');
    isChecking.value = false;
    return;
  }
  try {
    verifiedEmail.value = (await session.verifyEmail(token.value)).email;
  } catch (err) {
    const isInvalidLink = err instanceof ApiError && err.status === BAD_REQUEST;
    errorMessage.value = isInvalidLink ? t('auth.verifyEmail.invalid') : describeError(err);
  } finally {
    isChecking.value = false;
  }
});
</script>

<template>
  <div class="relative mt-12">
    <PeekingBookworm
      :mood="errorMessage ? 'sad' : 'happy'"
      class="absolute -top-12 right-8 size-24"
    />
    <UCard class="relative ring-0 shadow-pop">
      <template #header>
        <h1 class="text-2xl font-extrabold text-highlighted">{{ t('auth.verifyEmail.title') }}</h1>
      </template>

      <p v-if="isChecking" class="text-sm text-toned">{{ t('auth.verifyEmail.checking') }}</p>

      <UAlert
        v-else-if="verifiedEmail"
        color="success"
        variant="subtle"
        icon="i-lucide-check"
        :description="t('auth.verifyEmail.done', { email: verifiedEmail })"
      />

      <div v-else class="flex flex-col gap-2">
        <UAlert color="error" variant="subtle" :description="errorMessage" />
        <p class="text-sm text-toned">
          {{
            session.isSignedIn
              ? t('auth.verifyEmail.invalidHintSignedIn')
              : t('auth.verifyEmail.invalidHint')
          }}
        </p>
      </div>

      <template #footer>
        <UButton :to="{ name: session.isSignedIn ? 'home' : 'sign-in' }" block>
          {{ session.isSignedIn ? t('auth.verifyEmail.toApp') : t('auth.signIn') }}
        </UButton>
      </template>
    </UCard>
  </div>
</template>

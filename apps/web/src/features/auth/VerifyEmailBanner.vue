<script lang="ts">
import { ref } from 'vue';

/** "Teď ne" holds for this visit: the banner is back after a reload. */
const isPutOff = ref(false);
</script>

<script setup lang="ts">
import { computed, ref as localRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import { describeError } from '@/app/errors';
import { useOnboardingTour } from '@/features/onboarding/use-onboarding-tour';
import { useSessionStore } from './session-store';

/**
 * Over every page until the reader confirms their address: e-mails (reminders, friends) and
 * invitations by e-mail wait for it. Not during the tour, which has the page to itself.
 */
const { t } = useI18n();
const toast = useToast();
const session = useSessionStore();
const tour = useOnboardingTour();
const isSending = localRef(false);

const isShown = computed(
  () =>
    session.isSignedIn &&
    !session.isEmailVerified &&
    !isPutOff.value &&
    tour.state.value.phase === 'closed'
);

async function resend(): Promise<void> {
  isSending.value = true;
  try {
    await session.sendVerificationEmail();
    toast.add({ title: t('auth.verifyEmail.resent'), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    isSending.value = false;
  }
}
</script>

<template>
  <!-- No accessible name: "e-mail" in it would make every "E-mail" field's label ambiguous. -->
  <section
    v-if="isShown"
    class="flex flex-col gap-3 rounded-xl bg-sky-100 px-4 py-3 ring-2 ring-line sm:flex-row sm:items-center dark:bg-sky-400/15"
  >
    <UIcon name="i-lucide-mail-check" class="hidden size-5 shrink-0 text-primary sm:block" />

    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <p class="font-bold text-highlighted">{{ t('auth.verifyEmail.bannerTitle') }}</p>
      <p class="text-sm text-toned">
        {{ t('auth.verifyEmail.bannerText', { email: session.user?.email ?? '' }) }}
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-send"
        :loading="isSending"
        @click="resend"
      >
        {{ t('auth.verifyEmail.resend') }}
      </UButton>
      <UButton color="neutral" variant="ghost" @click="isPutOff = true">
        {{ t('auth.verifyEmail.later') }}
      </UButton>
    </div>
  </section>
</template>

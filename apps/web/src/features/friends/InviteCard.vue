<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import { renderSVG } from 'uqr';
import { friendInvitationFields } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import { formSchema, VALIDATE_ON } from '@/app/validation';
import { TOUR_TARGETS } from '@/features/onboarding/tour-steps';
import { inviteLink, useInviteByEmail, useMyInvite, useReplaceInvite } from './api';

/**
 * Ways to bring friends in: the reader's own invite link — copied, shared or shown as a QR code
 * to a phone across the table — or an invitation by e-mail.
 */
const { t } = useI18n();
const toast = useToast();

const { data: invite } = useMyInvite();
const link = computed(() => (invite.value ? inviteLink(invite.value.code) : ''));
const qrCode = computed(() => (link.value ? renderSVG(link.value, { border: 2 }) : ''));
const isShowingQrCode = ref(false);
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(link.value);
    toast.add({ title: t('friends.invite.copied'), color: 'success' });
  } catch {
    toast.add({ title: t('friends.invite.copyFailed'), color: 'error' });
  }
}

async function shareLink(): Promise<void> {
  try {
    await navigator.share({ title: t('friends.invite.shareTitle'), url: link.value });
  } catch {
    // Closing the share sheet is no error worth telling.
  }
}

const { mutateAsync: replaceInvite, isPending: isReplacing } = useReplaceInvite();
const isConfirmingReplace = ref(false);

async function confirmReplace(): Promise<void> {
  try {
    await replaceInvite();
    toast.add({ title: t('friends.invite.replaced'), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    isConfirmingReplace.value = false;
  }
}

const schema = formSchema(friendInvitationFields, 'create');
const state = reactive({ email: '' });
const { mutateAsync: inviteByEmail, isPending: isInviting } = useInviteByEmail();

async function sendInvitation(): Promise<void> {
  try {
    await inviteByEmail(state.email);
    toast.add({ title: t('friends.invite.sent', { email: state.email.trim() }), color: 'success' });
    state.email = '';
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}
</script>

<template>
  <UCard :data-tour="TOUR_TARGETS.friends">
    <template #header>
      <h2 class="text-lg font-bold text-highlighted">{{ t('friends.invite.title') }}</h2>
    </template>

    <div class="flex flex-col gap-5">
      <section class="flex flex-col gap-3">
        <p class="text-sm text-toned">{{ t('friends.invite.linkHint') }}</p>
        <div class="flex flex-wrap gap-2">
          <UInput
            :model-value="link"
            readonly
            :aria-label="t('friends.invite.link')"
            class="min-w-0 flex-1 basis-60"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <UButton icon="i-lucide-copy" :disabled="!link" @click="copyLink">
            {{ t('friends.invite.copy') }}
          </UButton>
          <UButton
            v-if="canShare"
            icon="i-lucide-share-2"
            color="neutral"
            variant="outline"
            :disabled="!link"
            @click="shareLink"
          >
            {{ t('friends.invite.share') }}
          </UButton>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            icon="i-lucide-qr-code"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="!link"
            :aria-expanded="isShowingQrCode"
            @click="isShowingQrCode = !isShowingQrCode"
          >
            {{ isShowingQrCode ? t('friends.invite.hideQrCode') : t('friends.invite.showQrCode') }}
          </UButton>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="isConfirmingReplace = true"
          >
            {{ t('friends.invite.replace') }}
          </UButton>
        </div>
        <!-- White all around, so a phone reads it in dark mode too. The SVG is uqr's drawing of
             our own link: nothing a reader typed reaches the markup. -->
        <!-- eslint-disable vue/no-v-html -->
        <div
          v-if="isShowingQrCode && qrCode"
          role="img"
          :aria-label="t('friends.invite.qrCode')"
          class="w-56 self-center rounded-xl bg-white p-2 ring-2 ring-line [&>svg]:h-auto [&>svg]:w-full"
          v-html="qrCode"
        />
        <!-- eslint-enable vue/no-v-html -->
      </section>

      <UForm
        :schema="schema"
        :state="state"
        :validate-on="VALIDATE_ON"
        class="flex flex-col gap-3 border-t border-default pt-5"
        @submit="sendInvitation"
      >
        <UFormField
          :label="t('friends.invite.byEmail')"
          :help="t('friends.invite.byEmailHint')"
          name="email"
        >
          <div class="flex flex-wrap gap-2">
            <UInput
              v-model="state.email"
              type="email"
              autocomplete="off"
              :placeholder="t('friends.invite.emailPlaceholder')"
              class="min-w-0 flex-1 basis-60"
            />
            <UButton type="submit" icon="i-lucide-send" :loading="isInviting">
              {{ t('friends.invite.send') }}
            </UButton>
          </div>
        </UFormField>
      </UForm>
    </div>

    <UModal
      v-model:open="isConfirmingReplace"
      :title="t('friends.invite.replace')"
      :description="t('friends.invite.replaceConfirm')"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="isConfirmingReplace = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton :loading="isReplacing" @click="confirmReplace">
            {{ t('friends.invite.replace') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </UCard>
</template>

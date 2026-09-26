<script setup lang="ts">
import { computed, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { fileUrl } from '@/app/api';
import { describeError } from '@/app/errors';
import PersonAvatar from '@/components/PersonAvatar.vue';
import PeekingBookworm from '@/components/PeekingBookworm.vue';
import { useSessionStore } from '@/features/auth/session-store';
import { useAcceptInvite, useInvite } from '@/features/friends/api';

/**
 * An invite link, opened: whose it is and, for a signed-in reader, the way to become friends. A
 * visitor signs up or in first and comes back here.
 */
const props = defineProps<{ code: string }>();

const { t } = useI18n();
const router = useRouter();
const toast = useToast();
const session = useSessionStore();

const code = toRef(props, 'code');
const isSignedIn = computed(() => session.isSignedIn);
const { data: invite, error, isPending } = useInvite(code, isSignedIn);
const inviter = computed(() => invite.value?.inviter);
/** Back to this page once signed up or in. */
const returnHere = computed(() => ({ redirect: `/invite/${encodeURIComponent(props.code)}` }));

const { mutateAsync: acceptInvite, isPending: isAccepting } = useAcceptInvite();

async function accept(): Promise<void> {
  try {
    const friend = await acceptInvite(props.code);
    toast.add({
      title: t('friends.inviteLanding.accepted', { name: friend.displayName }),
      color: 'success',
    });
    await router.push({ name: 'friend', params: { userId: friend.id } });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}
</script>

<template>
  <div class="relative mt-12">
    <PeekingBookworm mood="happy" class="absolute -top-12 right-8 size-24" />
    <UCard class="relative ring-0 shadow-pop">
      <div v-if="isPending" class="flex flex-col items-center gap-3 py-6">
        <USkeleton class="size-16 rounded-full" />
        <USkeleton class="h-6 w-2/3" />
      </div>

      <div v-else-if="error || !inviter" class="flex flex-col items-center gap-3 py-4 text-center">
        <UIcon name="i-lucide-link-2-off" class="size-10 text-muted" />
        <h1 class="text-xl font-bold text-highlighted">{{ t('friends.inviteLanding.invalid') }}</h1>
        <p class="text-sm text-toned">{{ t('friends.inviteLanding.invalidHint') }}</p>
        <UButton :to="{ name: 'home' }" color="neutral" variant="outline">
          {{ t('friends.inviteLanding.toApp') }}
        </UButton>
      </div>

      <div v-else class="flex flex-col items-center gap-4 py-2 text-center">
        <PersonAvatar :name="inviter.displayName" :src="fileUrl(inviter.avatar)" size="3xl" />
        <h1 class="text-2xl font-extrabold text-highlighted">
          {{ t('friends.inviteLanding.title', { name: inviter.displayName }) }}
        </h1>
        <p class="text-sm text-toned">{{ t('friends.inviteLanding.hint') }}</p>

        <template v-if="!isSignedIn">
          <div class="flex w-full flex-col gap-2">
            <UButton :to="{ name: 'sign-up', query: returnHere }" block>
              {{ t('friends.inviteLanding.signUp') }}
            </UButton>
            <UButton
              :to="{ name: 'sign-in', query: returnHere }"
              color="neutral"
              variant="outline"
              block
            >
              {{ t('friends.inviteLanding.signIn') }}
            </UButton>
          </div>
        </template>
        <template v-else-if="invite?.relation === 'self'">
          <p class="font-semibold text-highlighted">{{ t('friends.inviteLanding.self') }}</p>
          <UButton :to="{ name: 'friends' }" color="neutral" variant="outline">
            {{ t('friends.title') }}
          </UButton>
        </template>
        <template v-else-if="invite?.relation === 'friends'">
          <p class="font-semibold text-highlighted">{{ t('friends.inviteLanding.already') }}</p>
          <UButton :to="{ name: 'friend', params: { userId: inviter.id } }">
            {{ t('friends.inviteLanding.openLibrary') }}
          </UButton>
        </template>
        <UButton
          v-else
          icon="i-lucide-user-plus"
          size="lg"
          block
          :loading="isAccepting"
          @click="accept"
        >
          {{ t('friends.inviteLanding.accept') }}
        </UButton>
      </div>
    </UCard>
  </div>
</template>

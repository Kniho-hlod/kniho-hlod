<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import { recommendationBodyFields } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import { formSchema, VALIDATE_ON } from '@/app/validation';
import { useFriends } from '@/features/friends/api';
import { useRecommendBook } from './api';

/** Recommends one of the reader's books to some of their friends, with a few words. */
const props = defineProps<{ bookId: string; title: string }>();
const open = defineModel<boolean>('open', { required: true });

interface RecommendForm {
  recipientIds: string[];
  message: string;
}

const { t } = useI18n();
const toast = useToast();

const schema = formSchema(recommendationBodyFields, 'patch');
const form = reactive<RecommendForm>({ recipientIds: [], message: '' });
const errorMessage = ref('');

const { data: friends } = useFriends();
const friendItems = computed(() =>
  (friends.value ?? []).map((friend) => ({ label: friend.displayName, value: friend.id }))
);

const { mutateAsync: recommend, isPending: isSending } = useRecommendBook();

async function send(): Promise<void> {
  errorMessage.value = '';
  if (form.recipientIds.length === 0) {
    errorMessage.value = t('recommendations.pickFriends');
    return;
  }
  try {
    await recommend({
      bookId: props.bookId,
      recipientIds: form.recipientIds,
      message: form.message.trim() || null,
    });
    toast.add({
      title: t('recommendations.sent'),
      color: 'success',
    });
    Object.assign(form, { recipientIds: [], message: '' });
    open.value = false;
  } catch (err) {
    errorMessage.value = describeError(err);
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('recommendations.title')"
    :description="t('recommendations.hint', { title })"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="form"
        :validate-on="VALIDATE_ON"
        class="flex flex-col gap-4"
        @submit="send"
      >
        <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

        <UFormField :label="t('recommendations.to')" name="recipientIds" required>
          <USelectMenu
            v-model="form.recipientIds"
            :items="friendItems"
            value-key="value"
            multiple
            :placeholder="t('recommendations.toPlaceholder')"
            :aria-label="t('recommendations.to')"
            icon="i-lucide-users-round"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('recommendations.message')" name="message">
          <UTextarea
            v-model="form.message"
            :placeholder="t('recommendations.messagePlaceholder')"
            :rows="3"
            autoresize
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="open = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" icon="i-lucide-send" :loading="isSending">
            {{ t('recommendations.send') }}
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>

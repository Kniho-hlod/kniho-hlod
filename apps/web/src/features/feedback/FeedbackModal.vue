<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { DEFAULT_FEEDBACK_KIND, FEEDBACK_KINDS, feedbackReportFields } from '@kniho-hlod/domain';
import type { FeedbackKind } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import { pickFields } from '@/app/fields';
import { formSchema, VALIDATE_ON } from '@/app/validation';
import { useSendFeedback } from './api';

/** A reader's report to the administrators, sent from wherever in the app they are. */
const open = defineModel<boolean>('open', { required: true });

interface FeedbackForm {
  kind: FeedbackKind;
  message: string;
  screenshot: File | null;
}

const { t } = useI18n();
const route = useRoute();
const toast = useToast();

const schema = formSchema(pickFields(feedbackReportFields, ['kind', 'message']), 'create');
const emptyForm = (): FeedbackForm => ({
  kind: DEFAULT_FEEDBACK_KIND,
  message: '',
  screenshot: null,
});
const form = reactive<FeedbackForm>(emptyForm());
const errorMessage = ref('');
const kindItems = computed(() =>
  FEEDBACK_KINDS.map((kind) => ({ value: kind, label: t(`feedback.kinds.${kind}`) }))
);

const { mutateAsync: sendFeedback, isPending: isSending } = useSendFeedback();

async function send(): Promise<void> {
  errorMessage.value = '';
  try {
    const { screenshotSaved } = await sendFeedback({ ...form, pagePath: route.fullPath });
    toast.add(
      screenshotSaved
        ? { title: t('feedback.sent'), color: 'success' }
        : { title: t('feedback.sentWithoutScreenshot'), color: 'warning' }
    );
    Object.assign(form, emptyForm());
    open.value = false;
  } catch (err) {
    errorMessage.value = describeError(err);
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('feedback.title')" :description="t('feedback.hint')">
    <template #body>
      <UForm
        :schema="schema"
        :state="form"
        :validate-on="VALIDATE_ON"
        class="flex flex-col gap-4"
        @submit="send"
      >
        <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

        <UFormField :label="t('feedback.kind')" name="kind">
          <URadioGroup
            v-model="form.kind"
            :items="kindItems"
            orientation="horizontal"
            variant="card"
            :ui="{ fieldset: 'grid grid-cols-3 gap-2' }"
          />
        </UFormField>

        <UFormField :label="t('feedback.message')" name="message" required>
          <UTextarea
            v-model="form.message"
            :placeholder="t(`feedback.placeholders.${form.kind}`)"
            :rows="5"
            autoresize
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="t('feedback.screenshot')"
          :description="t('feedback.screenshotHint')"
          name="screenshot"
        >
          <UFileUpload
            v-model="form.screenshot"
            accept="image/*"
            icon="i-lucide-image"
            :label="t('feedback.screenshotPick')"
            layout="list"
            class="min-h-24 w-full"
          />
        </UFormField>

        <p class="flex items-start gap-2 text-sm text-muted">
          <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0" />
          {{ t('feedback.contextNote') }}
        </p>

        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="open = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" icon="i-lucide-send" :loading="isSending">
            {{ t('feedback.send') }}
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import {
  findActiveRangeIssues,
  NOTIFICATION_SEVERITIES,
  systemNotificationFields,
} from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import { pickFields } from '@/app/fields';
import { goBackOr } from '@/app/navigation';
import { formSchema, VALIDATE_ON } from '@/app/validation';
import FormActions from '@/components/FormActions.vue';
import {
  ANNOUNCEMENT_FORM_FIELDS,
  announcementFormFrom,
  newAnnouncementForm,
} from '@/features/announcements/announcement-form';
import {
  useAnnouncement,
  useDeleteAnnouncement,
  useSaveAnnouncement,
} from '@/features/announcements/api';
import { SEVERITY_STYLES } from '@/features/announcements/severity-styles';

/** Without `id` the form adds an announcement; with it, it edits that announcement. */
const props = defineProps<{ id?: string }>();

const { t } = useI18n();
const router = useRouter();
const toast = useToast();

const announcementId = toRef(props, 'id');
const isEditing = computed(() => announcementId.value !== undefined);
const {
  data: announcement,
  error: loadError,
  isPending: isLoading,
} = useAnnouncement(announcementId);

const schema = formSchema(
  pickFields(systemNotificationFields, ANNOUNCEMENT_FORM_FIELDS),
  'create',
  { refine: findActiveRangeIssues }
);
const state = reactive(newAnnouncementForm(new Date()));
const errorMessage = ref('');
const severityOptions = computed(() =>
  NOTIFICATION_SEVERITIES.map((severity) => ({
    label: t(`announcements.severities.${severity}`),
    value: severity,
  }))
);
const previewStyle = computed(() => SEVERITY_STYLES[state.severity]);

// The announcement to edit fills the form once — a refetch must not overwrite what's typed.
const hasFilledForm = ref(false);
watch(
  announcement,
  (loaded) => {
    if (!loaded || hasFilledForm.value) return;
    Object.assign(state, announcementFormFrom(loaded));
    hasFilledForm.value = true;
  },
  { immediate: true }
);

const backToList = { name: 'announcements' };
const { mutateAsync: saveAnnouncement, isPending: isSaving } = useSaveAnnouncement();

async function submit(): Promise<void> {
  errorMessage.value = '';
  try {
    await saveAnnouncement({ id: announcementId.value, form: { ...state } });
    toast.add({ title: t('announcements.saved'), color: 'success' });
    await router.push(backToList);
  } catch (err) {
    errorMessage.value = describeError(err);
  }
}

function cancel(): void {
  void goBackOr(router, backToList);
}

const isConfirmingDelete = ref(false);
const { mutateAsync: deleteAnnouncement, isPending: isDeleting } = useDeleteAnnouncement();

async function confirmDelete(): Promise<void> {
  if (!announcementId.value) return;
  try {
    await deleteAnnouncement(announcementId.value);
    toast.add({ title: t('announcements.deleted'), color: 'success' });
    await router.push(backToList);
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    isConfirmingDelete.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-3xl font-extrabold text-highlighted">
      {{ isEditing ? t('announcements.edit') : t('announcements.add') }}
    </h1>

    <USkeleton v-if="isEditing && isLoading && !loadError" class="h-64 w-full" />

    <UAlert
      v-else-if="loadError"
      color="error"
      variant="subtle"
      :description="describeError(loadError)"
    />

    <UForm
      v-else
      :schema="schema"
      :state="state"
      :validate-on="VALIDATE_ON"
      class="flex flex-col gap-4"
      @submit="submit"
    >
      <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

      <UCard>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField
            :label="t('announcements.fields.title')"
            name="title"
            required
            class="sm:col-span-2"
          >
            <UInput v-model="state.title" autocomplete="off" class="w-full" />
          </UFormField>
          <UFormField
            :label="t('announcements.fields.message')"
            name="message"
            required
            class="sm:col-span-2"
          >
            <UTextarea v-model="state.message" :rows="3" autoresize class="w-full" />
          </UFormField>
          <UFormField
            :label="t('announcements.fields.severity')"
            name="severity"
            class="sm:col-span-2"
          >
            <USelect
              v-model="state.severity"
              :items="severityOptions"
              :aria-label="t('announcements.fields.severity')"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('announcements.fields.activeFrom')" name="activeFrom" required>
            <UInput v-model="state.activeFrom" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField :label="t('announcements.fields.activeTo')" name="activeTo" required>
            <UInput v-model="state.activeTo" type="datetime-local" class="w-full" />
          </UFormField>
        </div>
      </UCard>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-muted">{{ t('announcements.preview') }}</h2>
        <UAlert
          :title="state.title || t('announcements.fields.title')"
          :description="state.message || t('announcements.fields.message')"
          :color="previewStyle.color"
          :icon="previewStyle.icon"
          variant="subtle"
        />
      </section>

      <FormActions>
        <UButton
          v-if="isEditing"
          color="error"
          variant="ghost"
          icon="i-lucide-trash-2"
          @click="isConfirmingDelete = true"
        >
          {{ t('announcements.delete') }}
        </UButton>
        <div class="ml-auto flex gap-2">
          <UButton color="neutral" variant="ghost" @click="cancel">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" icon="i-lucide-check" :loading="isSaving">
            {{ t('common.save') }}
          </UButton>
        </div>
      </FormActions>
    </UForm>

    <UModal
      v-model:open="isConfirmingDelete"
      :title="t('announcements.delete')"
      :description="t('announcements.deleteConfirm', { title: announcement?.title ?? '' })"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="isConfirmingDelete = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="isDeleting" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>

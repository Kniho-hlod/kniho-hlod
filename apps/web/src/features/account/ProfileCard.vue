<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { LOCALES, PROFILE_FIELDS, userFields } from '@kniho-hlod/domain';
import { pickFields } from '@/app/fields';
import { VALIDATE_ON, formSchema } from '@/app/validation';
import { describeError } from '@/app/errors';
import { LOCALE_LABELS } from '@/app/i18n';
import { useSessionStore } from '@/features/auth/session-store';
import { TOUR_TARGETS } from '@/features/onboarding/tour-steps';

const { t } = useI18n();
const session = useSessionStore();

const schema = formSchema(pickFields(userFields, [...PROFILE_FIELDS]), 'patch');
const state = reactive({
  displayName: session.user?.displayName ?? '',
  locale: session.user?.locale ?? 'cs',
  timezone: session.user?.timezone ?? '',
  emailReminders: session.user?.emailReminders ?? true,
  reminderDaysBefore: session.user?.reminderDaysBefore ?? 0,
});
const localeOptions = LOCALES.map((code) => ({ label: LOCALE_LABELS[code], value: code }));
const errorMessage = ref('');
const isSaved = ref(false);
const isSubmitting = ref(false);

async function saveProfile(): Promise<void> {
  errorMessage.value = '';
  isSaved.value = false;
  isSubmitting.value = true;
  try {
    await session.updateProfile({ ...state });
    isSaved.value = true;
  } catch (err) {
    errorMessage.value = describeError(err);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-bold text-highlighted">{{ t('account.profile') }}</h2>
    </template>

    <UForm
      :schema="schema"
      :state="state"
      :validate-on="VALIDATE_ON"
      class="flex flex-col gap-4"
      @submit="saveProfile"
    >
      <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />
      <UAlert
        v-else-if="isSaved"
        color="success"
        variant="subtle"
        icon="i-lucide-check"
        :description="t('account.profileSaved')"
      />

      <UFormField :label="t('auth.displayName')" name="displayName" required>
        <UInput v-model="state.displayName" class="w-full" />
      </UFormField>

      <UFormField :label="t('common.language')" name="locale">
        <USelect v-model="state.locale" :items="localeOptions" class="w-full" />
      </UFormField>

      <UFormField :label="t('account.timezone')" name="timezone">
        <UInput v-model="state.timezone" class="w-full" />
      </UFormField>

      <div class="flex flex-col gap-4" :data-tour="TOUR_TARGETS.reminders">
        <UFormField
          :label="t('account.emailReminders')"
          :description="t('account.remindersHint')"
          name="emailReminders"
        >
          <USwitch v-model="state.emailReminders" />
        </UFormField>

        <UFormField :label="t('account.reminderDaysBefore')" name="reminderDaysBefore">
          <UInputNumber v-model="state.reminderDaysBefore" :min="0" :max="30" class="w-36" />
        </UFormField>
      </div>

      <div>
        <UButton type="submit" :loading="isSubmitting">{{ t('common.save') }}</UButton>
      </div>
    </UForm>
  </UCard>
</template>

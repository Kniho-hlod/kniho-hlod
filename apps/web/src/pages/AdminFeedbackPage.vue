<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { DEFAULT_FEEDBACK_STATUS, FEEDBACK_STATUSES } from '@kniho-hlod/domain';
import type { FeedbackStatus, FeedbackWithDetails } from '@kniho-hlod/domain';
import { describeError } from '@/app/errors';
import EmptyState from '@/components/EmptyState.vue';
import FeedbackCard from '@/features/feedback/FeedbackCard.vue';
import { useDeleteFeedback, useFeedbackList, useSetFeedbackStatus } from '@/features/feedback/api';
import { useOnVisible } from '@/shared/use-on-visible';

const SKELETON_COUNT = 3;
const TAB_ICONS: Record<FeedbackStatus, string> = {
  new: 'i-lucide-inbox',
  resolved: 'i-lucide-check-check',
};
const EMPTY_ICONS: Record<FeedbackStatus, string> = {
  new: 'i-lucide-party-popper',
  resolved: 'i-lucide-archive',
};
/** Toasts after moving a report, by the status it moved to. */
const STATUS_TOASTS: Record<FeedbackStatus, string> = {
  new: 'admin.feedback.reopened',
  resolved: 'admin.feedback.resolved',
};

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();

function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return (FEEDBACK_STATUSES as readonly unknown[]).includes(value);
}

/** The tab lives in the address (`?status=resolved`), so it survives a reload. */
const status = computed<FeedbackStatus>({
  get: () => (isFeedbackStatus(route.query.status) ? route.query.status : DEFAULT_FEEDBACK_STATUS),
  set: (value) => {
    void router.replace({ query: value === DEFAULT_FEEDBACK_STATUS ? {} : { status: value } });
  },
});
const tabs = computed(() =>
  FEEDBACK_STATUSES.map((value) => ({
    label: t(`admin.feedback.tabs.${value}`),
    value,
    icon: TAB_ICONS[value],
  }))
);

const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } =
  useFeedbackList(status);
const reports = computed(() => data.value?.pages.flatMap((page) => page.data) ?? []);

function loadMore(): void {
  if (hasNextPage.value && !isFetchingNextPage.value) void fetchNextPage();
}

const listEnd = ref<HTMLElement | null>(null);
useOnVisible(listEnd, loadMore);

const { mutateAsync: setStatus } = useSetFeedbackStatus();

async function moveReport(report: FeedbackWithDetails, next: FeedbackStatus): Promise<void> {
  try {
    await setStatus({ report, status: next });
    toast.add({ title: t(STATUS_TOASTS[next]), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}

/** The report waiting for the administrator to confirm its deletion. */
const reportToDelete = ref<FeedbackWithDetails>();
const isConfirmingDelete = computed({
  get: () => reportToDelete.value !== undefined,
  set: (open) => {
    if (!open) reportToDelete.value = undefined;
  },
});
const { mutateAsync: deleteReport, isPending: isDeleting } = useDeleteFeedback();

async function confirmDelete(): Promise<void> {
  const report = reportToDelete.value;
  if (!report) return;
  try {
    await deleteReport(report);
    toast.add({ title: t('admin.feedback.deleted'), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    reportToDelete.value = undefined;
  }
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <UButton
      :to="{ name: 'admin' }"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="self-start"
    >
      {{ t('admin.title') }}
    </UButton>

    <header class="flex flex-col gap-1">
      <h1 class="text-3xl font-extrabold text-highlighted">{{ t('admin.feedback.title') }}</h1>
      <p class="text-muted">{{ t('admin.feedback.hint') }}</p>
    </header>

    <UTabs v-model="status" :items="tabs" :content="false" class="w-full" />

    <UAlert v-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <ul v-else-if="isPending" class="flex flex-col gap-3">
      <li v-for="index in SKELETON_COUNT" :key="index"><USkeleton class="h-40 w-full" /></li>
    </ul>

    <EmptyState
      v-else-if="reports.length === 0"
      size="section"
      :icon="EMPTY_ICONS[status]"
      :title="t(`admin.feedback.empty.${status}`)"
    />

    <template v-else>
      <ul class="flex flex-col gap-3">
        <li v-for="report in reports" :key="report.id">
          <FeedbackCard
            :report="report"
            @set-status="(next) => moveReport(report, next)"
            @delete="reportToDelete = report"
          />
        </li>
      </ul>
      <div ref="listEnd" />
      <UButton
        v-if="hasNextPage"
        color="neutral"
        variant="subtle"
        block
        :loading="isFetchingNextPage"
        @click="loadMore"
      >
        {{ t('common.loadMore') }}
      </UButton>
    </template>

    <UModal
      v-model:open="isConfirmingDelete"
      :title="t('admin.feedback.delete')"
      :description="
        t('admin.feedback.deleteConfirm', {
          name: reportToDelete?.reporter?.displayName ?? t('admin.feedback.unknownReporter'),
        })
      "
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="isConfirmingDelete = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="isDeleting" @click="confirmDelete">
            {{ t('admin.feedback.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>

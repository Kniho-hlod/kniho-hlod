<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DropdownMenuItem } from '@nuxt/ui';
import { DEFAULT_FEEDBACK_KIND, DEFAULT_FEEDBACK_STATUS } from '@kniho-hlod/domain';
import type { FeedbackKind, FeedbackStatus, FeedbackWithDetails } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { formatDateTime } from '@/app/dates';
import PersonAvatar from '@/components/PersonAvatar.vue';

interface KindStyle {
  icon: string;
  /** Literal Tailwind classes for the pill's colours in both modes. */
  classes: string;
}

const KIND_STYLES: Record<FeedbackKind, KindStyle> = {
  bug: {
    icon: 'i-lucide-bug',
    classes: 'bg-rose-200 text-rose-950 dark:bg-rose-400/20 dark:text-rose-200',
  },
  idea: {
    icon: 'i-lucide-lightbulb',
    classes: 'bg-yellow-200 text-yellow-950 dark:bg-yellow-400/20 dark:text-yellow-200',
  },
  other: {
    icon: 'i-lucide-message-circle',
    classes: 'bg-sky-200 text-sky-950 dark:bg-sky-400/20 dark:text-sky-200',
  },
};

/** The status the report's main button moves it to. */
const NEXT_STATUS: Record<FeedbackStatus, FeedbackStatus> = { new: 'resolved', resolved: 'new' };

const props = defineProps<{ report: FeedbackWithDetails }>();
const emit = defineEmits<{ 'set-status': [status: FeedbackStatus]; delete: [] }>();

const { t } = useI18n();

const kind = computed(() => props.report.kind ?? DEFAULT_FEEDBACK_KIND);
const isResolved = computed(() => props.report.status === 'resolved');
const screenshotUrl = computed(() => fileUrl(props.report.screenshot));

/** What the reader's app sent along, the parts it knew. */
const contextRows = computed(() =>
  [
    { key: 'page', value: props.report.pageUrl },
    { key: 'version', value: props.report.appVersion },
    { key: 'window', value: props.report.viewport },
    { key: 'browser', value: props.report.userAgent },
  ].filter((row): row is { key: string; value: string } => Boolean(row.value))
);

const moreActions = computed<DropdownMenuItem[]>(() => [
  {
    label: t('admin.feedback.delete'),
    icon: 'i-lucide-trash-2',
    color: 'error',
    onSelect: () => emit('delete'),
  },
]);
</script>

<template>
  <article class="flex flex-col gap-3 rounded-xl bg-default p-4 ring-2 ring-line">
    <header class="flex items-start justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge
          color="neutral"
          variant="soft"
          :icon="KIND_STYLES[kind].icon"
          :class="KIND_STYLES[kind].classes"
        >
          {{ t(`feedback.kinds.${kind}`) }}
        </UBadge>
        <time :datetime="report.createdAt" class="text-sm text-muted">
          {{ formatDateTime(report.createdAt) }}
        </time>
      </div>
      <UDropdownMenu :items="moreActions" :content="{ align: 'end' }">
        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="t('common.moreActions')"
        />
      </UDropdownMenu>
    </header>

    <p class="whitespace-pre-line text-highlighted">{{ report.message }}</p>

    <a
      v-if="screenshotUrl"
      :href="screenshotUrl"
      target="_blank"
      rel="noopener"
      class="self-start rounded-lg ring-2 ring-line transition-transform hover:-translate-y-0.5 motion-reduce:transition-none"
    >
      <img
        :src="screenshotUrl"
        :alt="t('admin.feedback.screenshot')"
        class="h-36 w-auto max-w-full rounded-lg object-cover object-top"
      />
    </a>

    <div class="flex items-center gap-2 text-sm">
      <template v-if="report.reporter">
        <PersonAvatar :name="report.reporter.displayName" size="sm" />
        <span class="flex min-w-0 flex-col">
          <span class="font-semibold text-highlighted">{{ report.reporter.displayName }}</span>
          <ULink :href="`mailto:${report.reporter.email}`" class="truncate">
            {{ report.reporter.email }}
          </ULink>
        </span>
      </template>
      <span v-else class="text-muted">{{ t('admin.feedback.unknownReporter') }}</span>
    </div>

    <dl v-if="contextRows.length" class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      <template v-for="row in contextRows" :key="row.key">
        <dt class="text-muted">{{ t(`admin.feedback.context.${row.key}`) }}</dt>
        <dd class="truncate text-toned" :title="row.value">{{ row.value }}</dd>
      </template>
    </dl>

    <footer class="flex justify-end">
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        :icon="isResolved ? 'i-lucide-rotate-ccw' : 'i-lucide-check'"
        @click="emit('set-status', NEXT_STATUS[report.status ?? DEFAULT_FEEDBACK_STATUS])"
      >
        {{ isResolved ? t('admin.feedback.reopen') : t('admin.feedback.resolve') }}
      </UButton>
    </footer>
  </article>
</template>

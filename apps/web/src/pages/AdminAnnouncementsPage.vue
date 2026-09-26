<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { describeError } from '@/app/errors';
import { useAnnouncements } from '@/features/announcements/api';
import AnnouncementCard from '@/features/announcements/AnnouncementCard.vue';

const SKELETON_COUNT = 3;

const { t } = useI18n();
const { data: announcements, error, isPending } = useAnnouncements();
/** What "running" and "over" are measured against while the page is open. */
const now = new Date();
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

    <header class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-3xl font-extrabold text-highlighted">{{ t('announcements.title') }}</h1>
      <UButton :to="{ name: 'announcement-new' }" icon="i-lucide-plus">
        {{ t('announcements.add') }}
      </UButton>
    </header>

    <p class="text-sm text-muted">{{ t('announcements.hint') }}</p>

    <UAlert v-if="error" color="error" variant="subtle" :description="describeError(error)" />

    <ul v-else-if="isPending" class="flex flex-col gap-2">
      <li v-for="index in SKELETON_COUNT" :key="index"><USkeleton class="h-24 w-full" /></li>
    </ul>

    <p v-else-if="!announcements?.length" class="text-muted">{{ t('announcements.empty') }}</p>

    <ul v-else class="flex flex-col gap-2">
      <li v-for="announcement in announcements" :key="announcement.id">
        <AnnouncementCard :announcement="announcement" :now="now" />
      </li>
    </ul>
  </section>
</template>

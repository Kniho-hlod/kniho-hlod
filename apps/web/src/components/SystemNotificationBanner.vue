<script setup lang="ts">
import { useActiveAnnouncements } from '@/features/announcements/api';
import { SEVERITY_STYLES } from '@/features/announcements/severity-styles';

// Public endpoint: announcements show on the sign-in page too.
const { data: notifications } = useActiveAnnouncements();
</script>

<template>
  <div v-if="notifications?.length" class="flex flex-col gap-2">
    <UAlert
      v-for="notification in notifications"
      :key="notification.id"
      :title="notification.title"
      :description="notification.message"
      :color="SEVERITY_STYLES[notification.severity].color"
      :icon="SEVERITY_STYLES[notification.severity].icon"
      variant="subtle"
    />
  </div>
</template>

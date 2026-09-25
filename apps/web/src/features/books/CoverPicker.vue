<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import BookCover from './BookCover.vue';

/** Photos straight from a phone are fine: they are scaled down before uploading. */
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

defineProps<{
  previewUrl: string | undefined;
  title: string;
  /** Shown under the buttons instead of the size hint, e.g. that the cover is from a catalogue. */
  note?: string;
}>();

const emit = defineEmits<{
  select: [image: File];
  remove: [];
  tooLarge: [];
}>();

const { t } = useI18n();

function selectImage(event: Event): void {
  const input = event.target as HTMLInputElement;
  const image = input.files?.[0];
  // Cleared, so choosing the same file again still counts as a change.
  input.value = '';
  if (!image) return;
  if (image.size > MAX_SOURCE_BYTES) {
    emit('tooLarge');
    return;
  }
  emit('select', image);
}
</script>

<template>
  <div class="flex items-start gap-4">
    <div class="w-28 shrink-0">
      <BookCover :url="previewUrl" :title="title || t('books.untitled')" />
    </div>
    <div class="flex flex-col items-start gap-2">
      <label>
        <input type="file" class="sr-only" :accept="ACCEPTED_TYPES" @change="selectImage" />
        <UButton as="span" icon="i-lucide-image-up" color="neutral" variant="subtle">
          {{ previewUrl ? t('books.changeCover') : t('books.addCover') }}
        </UButton>
      </label>
      <UButton
        v-if="previewUrl"
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        @click="emit('remove')"
      >
        {{ t('books.removeCover') }}
      </UButton>
      <p class="text-xs text-muted">{{ note ?? t('books.coverHint') }}</p>
    </div>
  </div>
</template>

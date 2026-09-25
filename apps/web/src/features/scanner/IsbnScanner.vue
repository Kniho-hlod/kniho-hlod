<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import ScannerViewfinder from './ScannerViewfinder.vue';

/** A dialog that films the back of a book until it reads the ISBN barcode there. */
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ detected: [isbn: string] }>();

const { t } = useI18n();

function handOverIsbn(isbn: string): void {
  open.value = false;
  emit('detected', isbn);
}
</script>

<template>
  <UModal v-model:open="open" :title="t('scanner.title')" :description="t('scanner.description')">
    <template #body>
      <!-- Mounted only while the dialog is open: the camera runs exactly that long. -->
      <ScannerViewfinder @detected="handOverIsbn" />
    </template>
  </UModal>
</template>

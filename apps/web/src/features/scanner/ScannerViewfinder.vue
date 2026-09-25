<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  BarcodeReaderUnavailableError,
  findIsbn,
  getBookBarcodeReader,
} from './book-barcode-reader';
import type { BarcodeReader } from './book-barcode-reader';
import { BARCODE_CAMERA, canUseCamera } from './camera-support';

/** How often a frame is searched for a barcode: often enough to feel instant, light on battery. */
const SCAN_INTERVAL_MS = 200;
/** Why the camera would not start, by `DOMException` name → the message key. */
const CAMERA_PROBLEMS: Record<string, string> = {
  NotAllowedError: 'scanner.cameraDenied',
  SecurityError: 'scanner.cameraDenied',
  NotFoundError: 'scanner.noCamera',
  // Chromium's answer on a machine with no video device at all.
  NotSupportedError: 'scanner.noCamera',
  OverconstrainedError: 'scanner.noCamera',
  NotReadableError: 'scanner.cameraBusy',
};

const emit = defineEmits<{ detected: [isbn: string] }>();

const { t } = useI18n();

const video = ref<HTMLVideoElement>();
const problem = ref<string>();
const isStarting = ref(true);

let stream: MediaStream | undefined;
let scanTimer: ReturnType<typeof setTimeout> | undefined;
let isStopped = false;

function describeProblem(err: unknown): string {
  if (err instanceof BarcodeReaderUnavailableError) return t('scanner.readerFailed');
  const key = err instanceof DOMException ? CAMERA_PROBLEMS[err.name] : undefined;
  return t(key ?? 'scanner.cameraFailed');
}

function stop(): void {
  isStopped = true;
  clearTimeout(scanTimer);
  for (const track of stream?.getTracks() ?? []) track.stop();
  stream = undefined;
}

function scanFrames(reader: BarcodeReader, source: HTMLVideoElement): void {
  const scanFrame = async () => {
    if (isStopped) return;
    try {
      const isbn = findIsbn(await reader.detect(source));
      if (isbn && !isStopped) {
        stop();
        emit('detected', isbn);
        return;
      }
    } catch (err) {
      // A frame the reader chokes on is skipped; the next one usually reads fine.
      console.warn('Barcode detection failed on a frame', err);
    }
    scanTimer = setTimeout(scanFrame, SCAN_INTERVAL_MS);
  };
  void scanFrame();
}

async function start(): Promise<void> {
  try {
    if (!canUseCamera()) throw new DOMException('No camera API', 'NotFoundError');
    // The reader loads while the camera starts; its failure is reported once it's awaited.
    const readerLoading = getBookBarcodeReader();
    readerLoading.catch(() => undefined);
    stream = await navigator.mediaDevices.getUserMedia(BARCODE_CAMERA);
    // Closed while the camera was starting: `stop` switches it off again.
    if (isStopped || !video.value) {
      stop();
      return;
    }
    video.value.srcObject = stream;
    await video.value.play();
    scanFrames(await readerLoading, video.value);
  } catch (err) {
    console.warn('The barcode scanner could not start', err);
    stop();
    problem.value = describeProblem(err);
  } finally {
    isStarting.value = false;
  }
}

onMounted(start);
onBeforeUnmount(stop);
</script>

<template>
  <div class="flex flex-col gap-3">
    <UAlert v-if="problem" color="warning" variant="subtle" :description="problem" />
    <div v-else class="relative overflow-hidden rounded-lg bg-black">
      <!-- iOS Safari plays camera video inline only when it is muted and `playsinline`. -->
      <video
        ref="video"
        class="aspect-[4/3] w-full object-cover"
        :aria-label="t('scanner.viewfinder')"
        muted
        playsinline
      />
      <div
        class="pointer-events-none absolute inset-x-[12%] top-1/2 h-1/3 -translate-y-1/2 rounded-md border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]"
        aria-hidden="true"
      />
      <div v-if="isStarting" class="absolute inset-0 flex items-center justify-center">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-white" />
      </div>
    </div>
    <p v-if="!problem" class="text-sm text-muted">{{ t('scanner.hint') }}</p>
  </div>
</template>

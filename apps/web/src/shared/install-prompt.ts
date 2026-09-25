import { computed, ref } from 'vue';

/** Chrome's `beforeinstallprompt` event; not in the DOM typings, as no standard defines it. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * How the app can be installed here: through the browser's own prompt (Chrome, Edge, Android),
 * by hand from the Share menu (iPhone, iPad), or not at all — already installed, or a browser
 * that can't.
 */
export type InstallOption = 'prompt' | 'share-menu' | 'none';

/** The prompt the browser offered, held back until the reader asks to install. */
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
const isInstalled = ref(false);

/**
 * Starts listening for the browser's install offer. Call it once at startup: the offer comes
 * early, often before any page that could show it has mounted.
 */
export function listenForInstallPrompt(target: Window = window): void {
  target.addEventListener('beforeinstallprompt', (event) => {
    // Keeps the browser from showing its own banner; the app offers installation itself.
    event.preventDefault();
    deferredPrompt.value = event as BeforeInstallPromptEvent;
  });
  target.addEventListener('appinstalled', () => {
    deferredPrompt.value = null;
    isInstalled.value = true;
  });
}

function isRunningInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true;
}

/** iPadOS reports itself as a Mac, told apart only by its touch screen. */
function isAppleMobile(): boolean {
  const isIpadAsMac = navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || isIpadAsMac;
}

export function useInstallPrompt() {
  const option = computed<InstallOption>(() => {
    if (isInstalled.value || isRunningInstalled()) return 'none';
    if (deferredPrompt.value) return 'prompt';
    return isAppleMobile() ? 'share-menu' : 'none';
  });

  /** Shows the browser's install dialog; each offer can be used once. */
  async function install(): Promise<void> {
    const prompt = deferredPrompt.value;
    if (!prompt) return;
    deferredPrompt.value = null;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') isInstalled.value = true;
  }

  return { option, install };
}

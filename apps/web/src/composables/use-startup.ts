import { readonly, ref, type Ref } from 'vue';
import { useRouter } from 'vue-router';

/** Even an instant start keeps the splash screen up long enough to read its first joke. */
const MIN_SPLASH_MS = 2000;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const isStarting = ref(true);
let hasBegun = false;

/**
 * Whether the app is still starting: until the first page is ready — which waits for the stored
 * session — and the splash screen has had its moment. A failed first navigation ends it too.
 * One start for the whole app: `App.vue` shows the splash screen while it lasts, the tour waits.
 */
export function useStartup(): Readonly<Ref<boolean>> {
  const router = useRouter();
  if (!hasBegun) {
    hasBegun = true;
    void Promise.allSettled([router.isReady(), wait(MIN_SPLASH_MS)]).then(() => {
      isStarting.value = false;
    });
  }
  return readonly(isStarting);
}

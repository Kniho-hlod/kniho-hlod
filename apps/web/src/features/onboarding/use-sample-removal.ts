import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import { describeError } from '@/app/errors';
import { useRemoveSampleLibrary } from './api';

/**
 * Removing the tour's samples, after a second click: the account page's card and the banner
 * over every page ask the same way.
 */
export function useSampleRemoval() {
  const { t } = useI18n();
  const toast = useToast();
  const { mutateAsync: removeSamples, isPending: isRemoving } = useRemoveSampleLibrary();
  const isConfirming = ref(false);

  async function remove(): Promise<void> {
    try {
      await removeSamples();
      isConfirming.value = false;
      toast.add({ title: t('samples.removed'), color: 'success' });
    } catch (err) {
      toast.add({ title: describeError(err), color: 'error' });
    }
  }

  return { isConfirming, isRemoving, remove };
}

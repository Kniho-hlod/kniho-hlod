import { computed } from 'vue';
import { readerToday } from '@kniho-hlod/domain';
import { useSessionStore } from '@/features/auth/session-store';

/** Today's date in the signed-in reader's time zone — the same "today" the API counts loans by. */
export function useToday() {
  const session = useSessionStore();
  return computed(() => readerToday(session.user?.timezone));
}

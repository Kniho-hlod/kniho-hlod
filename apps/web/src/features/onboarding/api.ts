import type { MaybeRefOrGetter } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { services } from '@/app/api';
import { invalidateLibrary, QUERY_KEYS } from '@/app/library-queries';

/** Whether the sample library can go in, or is in and can be removed. */
export function useSampleLibrary(enabled: MaybeRefOrGetter<boolean> = true) {
  return useQuery({
    queryKey: [QUERY_KEYS.sampleLibrary],
    queryFn: () => services.sampleLibrary.state(),
    enabled,
  });
}

export function useFillSampleLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => services.sampleLibrary.fill(),
    onSuccess: () => invalidateLibrary(queryClient),
  });
}

export function useRemoveSampleLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => services.sampleLibrary.remove(),
    onSuccess: () => invalidateLibrary(queryClient),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { RecommendBookRequest } from '@kniho-hlod/domain';
import { services } from '@/app/api';
import { invalidateLibrary } from '@/app/library-queries';

/** The first element of every recommendations query key. */
const RECOMMENDATIONS_KEY = 'recommendations';

/** Books friends recommended to the reader, waiting for an answer. */
export function useRecommendations() {
  return useQuery({
    queryKey: [RECOMMENDATIONS_KEY],
    queryFn: () => services.recommendations.list(),
  });
}

export function useRecommendBook() {
  return useMutation({
    mutationFn: (request: RecommendBookRequest) => services.recommendations.recommend(request),
  });
}

/** Takes a recommended book into the reader's library. */
export function useAcceptRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => services.recommendations.accept(id),
    onSuccess: () =>
      Promise.all([
        invalidateLibrary(queryClient),
        queryClient.invalidateQueries({ queryKey: [RECOMMENDATIONS_KEY] }),
      ]),
  });
}

export function useDismissRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => services.recommendations.dismiss(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [RECOMMENDATIONS_KEY] }),
  });
}

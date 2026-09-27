import type { Ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { services } from '@/app/api';

const COMMENTS_KEY = 'comments';

export function useComments(bookId: Ref<string>) {
  return useQuery({
    queryKey: [COMMENTS_KEY, bookId],
    queryFn: () => services.comments.list(bookId.value),
  });
}

/** Every change reloads the book's comments: the answer is the new truth, others may have written. */
function useCommentsMutation<Input>(bookId: Ref<string>, run: (input: Input) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMMENTS_KEY, bookId] }),
  });
}

export function useAddComment(bookId: Ref<string>) {
  return useCommentsMutation(bookId, (text: string) =>
    services.comments.add(bookId.value, text.trim())
  );
}

export interface CommentEdit {
  commentId: string;
  text: string;
}

export function useEditComment(bookId: Ref<string>) {
  return useCommentsMutation(bookId, ({ commentId, text }: CommentEdit) =>
    services.comments.edit(commentId, text.trim())
  );
}

export function useDeleteComment(bookId: Ref<string>) {
  return useCommentsMutation(bookId, (commentId: string) => services.comments.remove(commentId));
}

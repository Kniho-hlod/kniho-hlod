import type { Ref } from 'vue';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import type { PaginatedResponse } from '@eleansphere/entity-core';
import { FILE_ROLES } from '@kniho-hlod/domain';
import type { FeedbackKind, FeedbackStatus, FeedbackWithDetails } from '@kniho-hlod/domain';
import { services } from '@/app/api';
import { nextPageNumber } from '@/app/pagination';
import { BUILD, CURRENT_RELEASE } from '@/features/releases/releases';
import { resizeImage } from '@/shared/resize-image';
import { describeFeedbackContext } from './feedback-context';

/** Screenshots are stored at most this many pixels along their longer side. */
const SCREENSHOT_MAX_SIZE = 1600;
/** Shared with the administration's other queries, so a report also refreshes its stats. */
const ADMIN_QUERY_KEY = 'admin';
const FEEDBACK_QUERY_KEY = 'feedback';
export const FEEDBACK_PAGE_SIZE = 20;

export interface FeedbackDraft {
  kind: FeedbackKind;
  message: string;
  screenshot: File | null;
  /** The page the reader is on, `route.fullPath`. */
  pagePath: string;
}

export interface SentFeedback {
  /** `false` when the report went through but its screenshot didn't. */
  screenshotSaved: boolean;
}

/** Sends a report, then uploads its screenshot, if there is one. */
export function useSendFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: FeedbackDraft): Promise<SentFeedback> => {
      const context = describeFeedbackContext(
        draft.pagePath,
        `${CURRENT_RELEASE.version} · ${BUILD}`,
        window
      );
      const report = await services.feedback.report({
        kind: draft.kind,
        message: draft.message,
        ...context,
      });
      if (!draft.screenshot) return { screenshotSaved: true };
      try {
        const screenshot = await resizeImage(draft.screenshot, SCREENSHOT_MAX_SIZE);
        await services.feedback.files(FILE_ROLES.screenshot).upload(report.id, screenshot);
        return { screenshotSaved: true };
      } catch {
        return { screenshotSaved: false };
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ADMIN_QUERY_KEY] }),
  });
}

/** Reports in one state, the newest first, a page at a time. Administrators only. */
export function useFeedbackList(status: Ref<FeedbackStatus>) {
  return useInfiniteQuery({
    queryKey: [ADMIN_QUERY_KEY, FEEDBACK_QUERY_KEY, status],
    queryFn: ({ pageParam }) =>
      services.feedback.getAll({
        filter: { status: status.value },
        page: pageParam,
        limit: FEEDBACK_PAGE_SIZE,
      }) as Promise<PaginatedResponse<FeedbackWithDetails>>,
    initialPageParam: 1,
    getNextPageParam: nextPageNumber,
  });
}

export interface StatusChange {
  report: FeedbackWithDetails;
  status: FeedbackStatus;
}

export function useSetFeedbackStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ report, status }: StatusChange) =>
      services.feedback.update(report.id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ADMIN_QUERY_KEY] }),
  });
}

/** Deletes a report with its screenshot. */
export function useDeleteFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (report: FeedbackWithDetails) => services.feedback.delete(report.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ADMIN_QUERY_KEY] }),
  });
}

import { ApiClient } from '@eleansphere/entity-core';
import { BOOKS_PATH } from './entities';
import type { PersonSummary } from './friends';

/** `PATCH` and `DELETE /api/comments/:id`; a book's comments live at `/api/books/:id/comments`. */
export const COMMENTS_PATH = '/api/comments';

/** A comment as the book's readers see it, with what the reader may do to it. */
export interface CommentItem {
  id: string;
  author: PersonSummary;
  text: string;
  createdAt: string;
  /** `null` for a comment never edited. */
  editedAt: string | null;
  /** The reader wrote it. */
  canEdit: boolean;
  /** The reader wrote it, or owns the book. */
  canDelete: boolean;
}

/** `POST /api/books/:id/comments`, `PATCH /api/comments/:id`. */
export interface CommentBody {
  text: string;
}

function bookCommentsPath(bookId: string): string {
  return `${BOOKS_PATH}/${encodeURIComponent(bookId)}/comments`;
}

/** Comments under a book — the reader's own or a friend's shared one. */
export class CommentsService extends ApiClient {
  list(bookId: string): Promise<CommentItem[]> {
    return this.get<CommentItem[]>(bookCommentsPath(bookId));
  }

  add(bookId: string, text: string): Promise<CommentItem> {
    const body: CommentBody = { text };
    return this.post<CommentItem>(bookCommentsPath(bookId), body);
  }

  edit(commentId: string, text: string): Promise<CommentItem> {
    const body: CommentBody = { text };
    return this.patch<CommentItem>(`${COMMENTS_PATH}/${encodeURIComponent(commentId)}`, body);
  }

  remove(commentId: string): Promise<void> {
    return this.httpDelete(`${COMMENTS_PATH}/${encodeURIComponent(commentId)}`);
  }
}

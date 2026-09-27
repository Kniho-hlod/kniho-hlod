<script setup lang="ts">
import { computed, reactive, ref, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@nuxt/ui/composables';
import type { DropdownMenuItem } from '@nuxt/ui';
import { commentBodyFields } from '@kniho-hlod/domain';
import type { CommentItem } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { formatDateTime } from '@/app/dates';
import { describeError } from '@/app/errors';
import { formSchema, VALIDATE_ON } from '@/app/validation';
import PersonAvatar from '@/components/PersonAvatar.vue';
import { useAddComment, useComments, useDeleteComment, useEditComment } from './api';

/**
 * The talk under a book: its owner and the owner's friends who see it. `whenEmpty` says what a
 * book without comments shows: an invitation to write the first (`invite`), or nothing (`hide` —
 * the owner's own book nobody else sees).
 */
const props = defineProps<{ bookId: string; whenEmpty: 'invite' | 'hide' }>();

const { t } = useI18n();
const toast = useToast();
const bookId = toRef(props, 'bookId');

const { data: comments, isPending } = useComments(bookId);
const isShown = computed(() => props.whenEmpty === 'invite' || (comments.value?.length ?? 0) > 0);

const schema = formSchema(commentBodyFields, 'create');
const draft = reactive({ text: '' });
const { mutateAsync: addComment, isPending: isAdding } = useAddComment(bookId);

async function send(): Promise<void> {
  try {
    await addComment(draft.text);
    draft.text = '';
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}

/** The comment being rewritten, and its new text. */
const editing = ref<{ id: string; text: string } | null>(null);
const { mutateAsync: editComment, isPending: isSaving } = useEditComment(bookId);

async function saveEdit(): Promise<void> {
  if (!editing.value) return;
  try {
    await editComment({ commentId: editing.value.id, text: editing.value.text });
    editing.value = null;
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  }
}

const deleting = ref<CommentItem | null>(null);
const { mutateAsync: deleteComment, isPending: isDeleting } = useDeleteComment(bookId);

async function confirmDelete(): Promise<void> {
  if (!deleting.value) return;
  try {
    await deleteComment(deleting.value.id);
    toast.add({ title: t('comments.deleted'), color: 'success' });
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    deleting.value = null;
  }
}

function actionsFor(comment: CommentItem): DropdownMenuItem[] {
  return [
    ...(comment.canEdit
      ? [
          {
            label: t('comments.edit'),
            icon: 'i-lucide-pencil',
            onSelect: () => {
              editing.value = { id: comment.id, text: comment.text };
            },
          },
        ]
      : []),
    ...(comment.canDelete
      ? [
          {
            label: t('comments.delete'),
            icon: 'i-lucide-trash-2',
            color: 'error' as const,
            onSelect: () => {
              deleting.value = comment;
            },
          },
        ]
      : []),
  ];
}
</script>

<template>
  <section v-if="isShown" class="flex flex-col gap-3" :aria-label="t('comments.title')">
    <h2 class="text-xl font-bold text-highlighted">
      {{ t('comments.title') }}
      <span v-if="comments?.length" class="text-base font-semibold text-muted">
        ({{ comments.length }})
      </span>
    </h2>

    <USkeleton v-if="isPending" class="h-16 w-full rounded-xl" />
    <p v-else-if="!comments?.length" class="text-sm text-muted">{{ t('comments.empty') }}</p>
    <ul v-else class="flex flex-col gap-3">
      <li
        v-for="comment in comments"
        :key="comment.id"
        class="flex gap-3 rounded-xl bg-default p-3 ring-2 ring-line/15"
      >
        <PersonAvatar
          :name="comment.author.displayName"
          :src="fileUrl(comment.author.avatar)"
          size="sm"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm">
              <span class="font-semibold text-highlighted">{{ comment.author.displayName }}</span>
              <span class="text-muted">
                · {{ formatDateTime(comment.createdAt) }}
                <template v-if="comment.editedAt"> · {{ t('comments.edited') }}</template>
              </span>
            </p>
            <UDropdownMenu
              v-if="comment.canEdit || comment.canDelete"
              :items="actionsFor(comment)"
              :content="{ align: 'end' }"
            >
              <UButton
                icon="i-lucide-ellipsis"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="t('comments.actions', { name: comment.author.displayName })"
              />
            </UDropdownMenu>
          </div>

          <form
            v-if="editing?.id === comment.id"
            class="flex flex-col gap-2"
            @submit.prevent="saveEdit"
          >
            <UTextarea
              v-model="editing.text"
              :rows="2"
              autoresize
              :aria-label="t('comments.edit')"
              class="w-full"
            />
            <div class="flex gap-2">
              <UButton type="submit" size="sm" :loading="isSaving" :disabled="!editing.text.trim()">
                {{ t('common.save') }}
              </UButton>
              <UButton color="neutral" variant="ghost" size="sm" @click="editing = null">
                {{ t('common.cancel') }}
              </UButton>
            </div>
          </form>
          <p v-else class="text-sm whitespace-pre-line text-default">{{ comment.text }}</p>
        </div>
      </li>
    </ul>

    <UForm
      :schema="schema"
      :state="draft"
      :validate-on="VALIDATE_ON"
      class="flex flex-col gap-2"
      @submit="send"
    >
      <UFormField name="text">
        <UTextarea
          v-model="draft.text"
          :rows="2"
          autoresize
          :placeholder="t('comments.placeholder')"
          :aria-label="t('comments.write')"
          class="w-full"
        />
      </UFormField>
      <UButton
        type="submit"
        icon="i-lucide-message-circle"
        class="self-start"
        :loading="isAdding"
        :disabled="!draft.text.trim()"
      >
        {{ t('comments.send') }}
      </UButton>
    </UForm>

    <UModal
      :open="deleting !== null"
      :title="t('comments.delete')"
      :description="t('comments.deleteConfirm')"
      @update:open="(open: boolean) => !open && (deleting = null)"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="deleting = null">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="isDeleting" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>

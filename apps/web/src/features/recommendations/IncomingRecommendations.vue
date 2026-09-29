<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import type { RecommendationItem } from '@kniho-hlod/domain';
import { fileUrl } from '@/app/api';
import { describeError } from '@/app/errors';
import PersonAvatar from '@/components/PersonAvatar.vue';
import BookThumbnail from '@/features/books/BookThumbnail.vue';
import { useAcceptRecommendation, useDismissRecommendation, useRecommendations } from './api';

/** Books friends recommended to the reader, to take into the library or set aside. */
const { t } = useI18n();
const router = useRouter();
const toast = useToast();

const { data: recommendations } = useRecommendations();
const { mutateAsync: accept } = useAcceptRecommendation();
const { mutateAsync: dismiss } = useDismissRecommendation();
/** The recommendation being answered, so only its buttons wait. */
const answering = ref<string | null>(null);

async function answer(item: RecommendationItem, take: boolean): Promise<void> {
  answering.value = item.id;
  try {
    if (take) {
      const book = await accept(item.id);
      toast.add({
        title: t('recommendations.taken', { title: item.book.title }),
        color: 'success',
        actions: [
          {
            label: t('recommendations.openBook'),
            onClick: () => void router.push({ name: 'book', params: { id: book.id } }),
          },
        ],
      });
    } else {
      await dismiss(item.id);
    }
  } catch (err) {
    toast.add({ title: describeError(err), color: 'error' });
  } finally {
    answering.value = null;
  }
}
</script>

<template>
  <section v-if="(recommendations ?? []).length > 0" class="flex flex-col gap-3">
    <h2 class="text-xl font-bold text-highlighted">{{ t('recommendations.incoming') }}</h2>
    <ul class="grid gap-3 lg:grid-cols-2">
      <li
        v-for="item in recommendations"
        :key="item.id"
        class="flex gap-3 rounded-xl bg-default p-3 ring-2 ring-line"
      >
        <BookThumbnail :url="fileUrl(item.book.cover)" :title="item.book.title" />
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <p class="flex items-center gap-2 text-sm text-default">
            <PersonAvatar
              :name="item.sender.displayName"
              :src="fileUrl(item.sender.avatar)"
              size="2xs"
            />
            <span class="min-w-0 truncate">
              {{ t('recommendations.from', { name: item.sender.displayName }) }}
            </span>
          </p>
          <div>
            <p class="font-display leading-tight font-bold text-highlighted">
              {{ item.book.title }}
            </p>
            <p v-if="item.book.author" class="text-sm text-toned">{{ item.book.author }}</p>
          </div>
          <p v-if="item.message" class="text-sm whitespace-pre-line text-default italic">
            {{ t('recommendations.quoted', { message: item.message }) }}
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              icon="i-lucide-bookmark-plus"
              size="sm"
              :loading="answering === item.id"
              @click="answer(item, true)"
            >
              {{ t('recommendations.take') }}
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="answering === item.id"
              @click="answer(item, false)"
            >
              {{ t('recommendations.dismiss') }}
            </UButton>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

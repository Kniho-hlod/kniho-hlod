import { computed } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { FILE_ROLES } from '@kniho-hlod/domain';
import { fileUrl, services } from '@/app/api';
import { useSessionStore } from '@/features/auth/session-store';
import { resizeImage } from '@/shared/resize-image';

const avatarSlot = services.users.files(FILE_ROLES.avatar);
/** Avatars show at most a few dozen pixels wide; this leaves room for sharp high-density screens. */
const AVATAR_SIZE = 512;

/** The signed-in reader's profile picture, and a way to replace it. */
export function useAvatar() {
  const session = useSessionStore();
  const queryClient = useQueryClient();
  const userId = computed(() => session.user?.id ?? '');
  const avatarQueryKey = computed(() => ['avatar', userId.value]);

  const { data: avatars } = useQuery({
    queryKey: avatarQueryKey,
    queryFn: () => avatarSlot.list(userId.value),
    enabled: computed(() => userId.value !== ''),
  });

  const { mutateAsync: uploadAvatar, isPending: isUploading } = useMutation({
    mutationFn: async (image: Blob) =>
      avatarSlot.upload(userId.value, await resizeImage(image, AVATAR_SIZE, { square: true })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: avatarQueryKey.value }),
  });

  return {
    avatarUrl: computed(() => fileUrl(avatars.value?.[0])),
    uploadAvatar,
    isUploading,
  };
}

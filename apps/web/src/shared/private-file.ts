import { onScopeDispose, ref, watch } from 'vue';
import type { Ref } from 'vue';
import type { FileDto } from '@eleansphere/entity-core';
import { fileUrl, session } from '@/app/api';

/** What the API answers for a private file the token doesn't open (expired, or not yours). */
const NOT_READABLE = [401, 404];

/**
 * Downloads a private file with the reader's token: an `<img>` can't send one, and a private
 * file answers nobody else. Renews the token once if the API turned it away.
 */
async function fetchPrivateFile(url: string): Promise<Blob> {
  const send = (token: string | null) =>
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const token = session.accessToken;
  let response = await send(token);
  if (NOT_READABLE.includes(response.status) && (await session.refresh(token))) {
    response = await send(session.accessToken);
  }
  if (!response.ok) throw new Error(`The file answered ${response.status}`);
  return response.blob();
}

/**
 * An address an `<img>` or a link can show a private file from (an object URL of the downloaded
 * bytes), or `undefined` while it loads, when there is no file or when it can't be read. The
 * object URL is let go when the file changes or the component goes.
 */
export function usePrivateFileUrl(
  file: Ref<Pick<FileDto, 'url'> | null | undefined>
): Ref<string | undefined> {
  const objectUrl = ref<string | undefined>();
  let current = 0;

  function release(): void {
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = undefined;
  }

  watch(
    () => fileUrl(file.value),
    async (url) => {
      const request = ++current;
      release();
      if (!url) return;
      try {
        const blob = await fetchPrivateFile(url);
        if (request === current) objectUrl.value = URL.createObjectURL(blob);
      } catch {
        // Left without a picture: the report reads the same without it.
      }
    },
    { immediate: true }
  );
  onScopeDispose(() => {
    current += 1;
    release();
  });

  return objectUrl;
}

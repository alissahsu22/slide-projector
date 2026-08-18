import { IMAGE_CONFIG } from './imageConfig';
import { preprocessImage } from './preprocessImage';
import {
  ImageProcessError,
  type PreprocessProgress,
  type ProcessedPhoto,
} from './types';

export type PreprocessItemResult =
  | { ok: true; photo: ProcessedPhoto }
  | { ok: false; error: ImageProcessError };

export type PreprocessBatchResult = {
  photos: ProcessedPhoto[];
  errors: ImageProcessError[];
};

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
      return;
    }
    window.setTimeout(() => resolve(), 0);
  });
}

async function runPool(
  count: number,
  limit: number,
  worker: (index: number) => Promise<void>,
): Promise<void> {
  let next = 0;

  async function run(): Promise<void> {
    while (next < count) {
      const index = next;
      next += 1;
      await worker(index);
      await yieldToMain();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, Math.max(count, 0)) }, () => run()),
  );
}

export async function preprocessImages(
  files: File[],
  onProgress?: (progress: number) => void,
): Promise<ProcessedPhoto[]> {
  const { photos } = await preprocessImageBatch(files, {
    onProgress: (status) => {
      onProgress?.(status.total === 0 ? 1 : status.done / status.total);
    },
  });
  return photos;
}

export async function preprocessImageBatch(
  files: File[],
  options?: {
    orderStart?: number;
    onProgress?: (progress: PreprocessProgress) => void;
    onItem?: (index: number, result: PreprocessItemResult) => void;
  },
): Promise<PreprocessBatchResult> {
  const list = [...files];
  const slots = new Array<ProcessedPhoto | null>(list.length).fill(null);
  const errors: ImageProcessError[] = [];
  let done = 0;
  const orderStart = options?.orderStart ?? 0;

  if (!list.length) {
    options?.onProgress?.({ done: 0, total: 0, fileName: '' });
    return { photos: [], errors };
  }

  await runPool(list.length, IMAGE_CONFIG.concurrency, async (index) => {
    const file = list[index];
    try {
      const photo = await preprocessImage(file, orderStart + index);
      slots[index] = photo;
      options?.onItem?.(index, { ok: true, photo });
    } catch (error) {
      const wrapped =
        error instanceof ImageProcessError
          ? error
          : new ImageProcessError(file.name, 'failed', `Couldn't prepare ${file.name}.`);
      errors.push(wrapped);
      options?.onItem?.(index, { ok: false, error: wrapped });
    } finally {
      done += 1;
      options?.onProgress?.({
        done,
        total: list.length,
        fileName: file.name,
      });
    }
  });

  return {
    photos: slots.filter((photo): photo is ProcessedPhoto => photo !== null),
    errors,
  };
}

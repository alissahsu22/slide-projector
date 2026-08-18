import { IMAGE_CONFIG } from './imageConfig';
import {
  DEFAULT_CROP,
  ImageProcessError,
  type ProcessedPhoto,
} from './types';

const IMAGE_TYPE = /^image\//;
const HEIC_TYPE = /^image\/hei[cf]$/i;
const HEIC_EXT = /\.hei[cf]$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|avif|hei[cf])$/i;

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

function isHeicLike(file: File): boolean {
  return HEIC_TYPE.test(file.type) || HEIC_EXT.test(file.name);
}

export function isImageFile(file: File): boolean {
  if (file.type && IMAGE_TYPE.test(file.type)) return true;
  return IMAGE_EXT.test(file.name);
}

function heicMessage(fileName: string): string {
  return `${fileName} is HEIC/HEIF, which this browser can't read. Export it as JPEG or PNG.`;
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image decode failed'));
    image.src = url;
  });
}

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, {
      imageOrientation: 'from-image',
    } as ImageBitmapOptions);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = await loadHtmlImage(url);
      return await createImageBitmap(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function targetSize(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  const scale = Math.min(1, maxEdge / longEdge);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function get2d(canvas: AnyCanvas): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { alpha: false }) ?? canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

function drawResized(
  source: ImageBitmap,
  maxEdge: number,
): { canvas: AnyCanvas; width: number; height: number } {
  const { width, height } = targetSize(source.width, source.height, maxEdge);
  const canvas = makeCanvas(width, height);
  get2d(canvas).drawImage(source, 0, 0, width, height);
  return { canvas, width, height };
}

function releaseCanvas(canvas: AnyCanvas): void {
  canvas.width = 0;
  canvas.height = 0;
}

async function encodeBlob(
  canvas: AnyCanvas,
  type: string,
  quality: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return (canvas as OffscreenCanvas).convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => {
        if (blob && blob.size > 0) resolve(blob);
        else reject(new Error('Image encode failed'));
      },
      type,
      quality,
    );
  });
}

async function compress(
  canvas: AnyCanvas,
  quality: number,
): Promise<{ blob: Blob; mimeType: string }> {
  try {
    const webp = await encodeBlob(canvas, 'image/webp', quality);
    if (webp.type === 'image/webp' && webp.size > 0) {
      return { blob: webp, mimeType: 'image/webp' };
    }
  } catch {
    // Safari / older browsers may refuse WebP encode.
  }
  const jpeg = await encodeBlob(canvas, 'image/jpeg', quality);
  return { blob: jpeg, mimeType: jpeg.type || 'image/jpeg' };
}

export async function preprocessImage(
  file: File,
  order: number,
): Promise<ProcessedPhoto> {
  if (!isImageFile(file)) {
    throw new ImageProcessError(
      file.name,
      'unsupported',
      `Couldn't use ${file.name} — that isn't a supported image.`,
    );
  }

  let bitmap: ImageBitmap | null = null;
  let imageCanvas: AnyCanvas | null = null;
  let thumbCanvas: AnyCanvas | null = null;

  try {
    try {
      bitmap = await decodeImage(file);
    } catch {
      throw new ImageProcessError(
        file.name,
        isHeicLike(file) ? 'unsupported' : 'corrupt',
        isHeicLike(file)
          ? heicMessage(file.name)
          : `Couldn't read ${file.name}. The file may be damaged.`,
      );
    }

    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;
    if (originalWidth < 1 || originalHeight < 1) {
      throw new ImageProcessError(
        file.name,
        'corrupt',
        `Couldn't read ${file.name}. The file may be damaged.`,
      );
    }

    const image = drawResized(bitmap, IMAGE_CONFIG.maxLongEdge);
    const thumb = drawResized(bitmap, IMAGE_CONFIG.thumbnailLongEdge);
    imageCanvas = image.canvas;
    thumbCanvas = thumb.canvas;
    bitmap.close();
    bitmap = null;

    const [full, preview] = await Promise.all([
      compress(imageCanvas, IMAGE_CONFIG.quality),
      compress(thumbCanvas, IMAGE_CONFIG.thumbnailQuality),
    ]);

    return {
      id: crypto.randomUUID(),
      originalName: file.name,
      imageBlob: full.blob,
      thumbnailBlob: preview.blob,
      width: image.width,
      height: image.height,
      aspectRatio: image.width / image.height,
      originalWidth,
      originalHeight,
      mimeType: full.mimeType,
      order,
      crop: { ...DEFAULT_CROP },
    };
  } catch (error) {
    if (error instanceof ImageProcessError) throw error;
    throw new ImageProcessError(
      file.name,
      isHeicLike(file) ? 'unsupported' : 'failed',
      isHeicLike(file)
        ? heicMessage(file.name)
        : `Couldn't prepare ${file.name}.`,
    );
  } finally {
    if (bitmap) bitmap.close();
    if (imageCanvas) releaseCanvas(imageCanvas);
    if (thumbCanvas) releaseCanvas(thumbCanvas);
  }
}

export type PhotoCrop = {
  x: number;
  y: number;
  zoom: number;
};

export const DEFAULT_CROP: PhotoCrop = {
  x: 0.5,
  y: 0.5,
  zoom: 1,
};

export type ProcessedPhoto = {
  id: string;
  originalName: string;
  imageBlob: Blob;
  thumbnailBlob: Blob;
  width: number;
  height: number;
  aspectRatio: number;
  originalWidth: number;
  originalHeight: number;
  mimeType: string;
  order: number;
  crop: PhotoCrop;
};

export type PreprocessErrorReason = 'unsupported' | 'corrupt' | 'failed';

export class ImageProcessError extends Error {
  readonly fileName: string;
  readonly reason: PreprocessErrorReason;

  constructor(fileName: string, reason: PreprocessErrorReason, message: string) {
    super(message);
    this.name = 'ImageProcessError';
    this.fileName = fileName;
    this.reason = reason;
  }
}

export type PreprocessProgress = {
  done: number;
  total: number;
  fileName: string;
};

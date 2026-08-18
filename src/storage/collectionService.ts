import { DEFAULT_CROP } from '../lib/images/types';
import { objectUrlFor } from '../media/objectUrls';
import type { Collection, Photo } from '../types/collection';
import { collectionRepository } from './collectionRepository';
import type { CollectionRecord, StoredPhoto } from './types';

export type { StoredPhoto };

const PALETTES = [
  { bodyColor: '#d8c7b0', accentColor: '#7a5230', labelTint: '#f3e6d0' },
  { bodyColor: '#cfd6c8', accentColor: '#3f6f88', labelTint: '#eef1e6' },
  { bodyColor: '#d7b7a2', accentColor: '#6b2f2a', labelTint: '#f0e2d0' },
  { bodyColor: '#d8d0c4', accentColor: '#8a2a28', labelTint: '#f2ece0' },
  { bodyColor: '#c8c4bc', accentColor: '#3a3a40', labelTint: '#ece8e0' },
  { bodyColor: '#e0c8a8', accentColor: '#c47838', labelTint: '#f4ead8' },
  { bodyColor: '#dcc4a0', accentColor: '#b44a28', labelTint: '#f0e4d0' },
  { bodyColor: '#c8d0d4', accentColor: '#3a6a88', labelTint: '#e8eef0' },
] as const;

function paletteFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i) * (i + 1)) % PALETTES.length;
  return PALETTES[hash] ?? PALETTES[0];
}

function toPhoto(photo: StoredPhoto): Photo {
  return {
    id: photo.id,
    src: objectUrlFor(`photo:${photo.id}`, photo.imageBlob),
    order: photo.order,
    width: photo.width,
    height: photo.height,
    crop: photo.crop ?? { ...DEFAULT_CROP },
  };
}

export function hydrateRecord(record: CollectionRecord, rememberedSlide?: number): Collection {
  const photos = record.photos
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(toPhoto);
  const first = record.photos.find((photo) => photo.id === photos[0]?.id) ?? record.photos[0];
  const max = Math.max(0, photos.length - 1);
  const currentSlide = Math.min(
    max,
    Math.max(0, rememberedSlide ?? record.collection.currentSlide ?? 0),
  );
  return {
    id: record.collection.id,
    title: record.collection.title,
    date: record.collection.date,
    createdAt: record.collection.createdAt,
    coverImage: first
      ? objectUrlFor(`thumb:${first.id}`, first.thumbnailBlob)
      : undefined,
    currentSlide,
    photos,
    ...paletteFor(record.collection.id),
  };
}

export type NewCollectionPhoto = {
  id: string;
  imageBlob: Blob;
  thumbnailBlob: Blob;
  width: number;
  height: number;
  originalWidth?: number;
  originalHeight?: number;
  aspectRatio?: number;
  mimeType?: string;
  originalName?: string;
  crop?: Photo['crop'];
};

export async function loadPersistedCollections(
  progress: Record<string, number> = {},
): Promise<Collection[]> {
  const records = await collectionRepository.list();
  return records.map((record) => hydrateRecord(record, progress[record.collection.id]));
}

export async function persistUserCollection(input: {
  title: string;
  date: string;
  photos: NewCollectionPhoto[];
}): Promise<Collection> {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const photos: StoredPhoto[] = input.photos.map((photo, order) => ({
    id: photo.id,
    collectionId: id,
    order,
    imageBlob: photo.imageBlob,
    thumbnailBlob: photo.thumbnailBlob,
    width: photo.width,
    height: photo.height,
    originalWidth: photo.originalWidth ?? photo.width,
    originalHeight: photo.originalHeight ?? photo.height,
    aspectRatio: photo.aspectRatio ?? photo.width / Math.max(photo.height, 1),
    mimeType: photo.mimeType ?? photo.imageBlob.type,
    originalName: photo.originalName,
    crop: photo.crop ?? { ...DEFAULT_CROP },
  }));
  const record: CollectionRecord = {
    collection: {
      id,
      title: input.title,
      date: input.date,
      createdAt,
      currentSlide: 0,
      photoIds: photos.map((photo) => photo.id),
    },
    photos,
  };
  await collectionRepository.save(record);
  return hydrateRecord(record, 0);
}

export function persistUserSlide(id: string, currentSlide: number): void {
  void collectionRepository.updateCurrentSlide(id, currentSlide).catch(() => undefined);
}

export type EditPhotoEntry =
  | { kind: 'existing'; storedPhoto: StoredPhoto }
  | { kind: 'new'; photo: NewCollectionPhoto };

export async function updateUserCollection(input: {
  id: string;
  title: string;
  date: string;
  photos: EditPhotoEntry[];
}): Promise<Collection> {
  const existing = await collectionRepository.get(input.id);
  if (!existing) throw new Error(`Collection ${input.id} not found`);

  const photos: StoredPhoto[] = input.photos.map((entry, order) => {
    if (entry.kind === 'existing') {
      return { ...entry.storedPhoto, order, collectionId: input.id };
    }
    const p = entry.photo;
    return {
      id: p.id,
      collectionId: input.id,
      order,
      imageBlob: p.imageBlob,
      thumbnailBlob: p.thumbnailBlob,
      width: p.width,
      height: p.height,
      originalWidth: p.originalWidth ?? p.width,
      originalHeight: p.originalHeight ?? p.height,
      aspectRatio: p.aspectRatio ?? p.width / Math.max(p.height, 1),
      mimeType: p.mimeType ?? p.imageBlob.type,
      originalName: p.originalName,
      crop: p.crop ?? { ...DEFAULT_CROP },
    };
  });

  const record: CollectionRecord = {
    collection: {
      ...existing.collection,
      title: input.title,
      date: input.date,
      currentSlide: Math.min(
        existing.collection.currentSlide,
        Math.max(0, photos.length - 1),
      ),
      photoIds: photos.map((p) => p.id),
    },
    photos,
  };
  await collectionRepository.save(record);
  return hydrateRecord(record);
}

export async function deleteUserCollection(id: string): Promise<void> {
  await collectionRepository.remove(id);
}

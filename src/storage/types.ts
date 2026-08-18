export type StoredCollection = {
  id: string;
  title: string;
  date: string;
  createdAt: number;
  currentSlide: number;
  photoIds: string[];
};

export type StoredPhoto = {
  id: string;
  collectionId: string;
  order: number;
  imageBlob: Blob;
  thumbnailBlob: Blob;
  width: number;
  height: number;
  originalWidth?: number;
  originalHeight?: number;
  aspectRatio?: number;
  mimeType?: string;
  originalName?: string;
  crop?: {
    x: number;
    y: number;
    zoom: number;
  };
};

export type CollectionRecord = {
  collection: StoredCollection;
  photos: StoredPhoto[];
};

export interface CollectionRepository {
  list(): Promise<CollectionRecord[]>;
  get(id: string): Promise<CollectionRecord | null>;
  /** Upserts the collection and prunes photo rows no longer in the record. */
  save(record: CollectionRecord): Promise<void>;
  updateCurrentSlide(id: string, currentSlide: number): Promise<void>;
  /** Removes the collection row plus every photo row indexed to it. */
  remove(id: string): Promise<void>;
  deletePhotos(photoIds: string[]): Promise<void>;
}

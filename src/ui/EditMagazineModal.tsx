import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { requestEject } from '../experience/controller';
import { MAX_PHOTOS } from '../lib/images/imageConfig';
import { preprocessImageBatch } from '../lib/images/preprocessImages';
import type { ProcessedPhoto } from '../lib/images/types';
import { objectUrlFor, revokeObjectUrl } from '../media/objectUrls';
import {
  finishDeleting,
  getState,
  setEditingId,
  startDeleting,
  updateCollectionInStore,
  useExperience,
} from '../state/store';
import { collectionRepository } from '../storage/collectionRepository';
import type { StoredPhoto } from '../storage/collectionService';
import {
  deleteUserCollection,
  updateUserCollection,
  type EditPhotoEntry,
} from '../storage/collectionService';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth(), year: now.getFullYear() };
}

function formatDate(month: number, year: number): string {
  return `${MONTHS[month] ?? 'January'} ${year}`;
}

function parseDate(date: string): { month: number; year: number } {
  const parts = date.trim().split(/\s+/);
  const monthName = parts[0] ?? '';
  const year = parseInt(parts[1] ?? '', 10);
  const monthIndex = MONTHS.findIndex((m) => m === monthName);
  const today = currentMonthYear();
  return {
    month: monthIndex >= 0 ? monthIndex : today.month,
    year: isNaN(year) ? today.year : year,
  };
}

function yearOptions(center: number): number[] {
  const years: number[] = [];
  for (let y = center - 10; y <= center + 2; y++) years.push(y);
  return years;
}

function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (!item) return list;
  next.splice(to, 0, item);
  return next;
}

function copyFiles(list: FileList | File[] | null | undefined): File[] {
  return list ? Array.from(list) : [];
}

type EditDraftPhoto = {
  key: string;
  source: 'existing' | 'new';
  thumbUrl: string;
  storedPhoto?: StoredPhoto;
  fileName?: string;
  status?: 'processing' | 'ready' | 'error';
  processed?: ProcessedPhoto;
  error?: string;
};

export function EditMagazineModal() {
  const editingId = useExperience((s) => s.editingId);
  const collection = useExperience((s) => s.collections.find((c) => c.id === editingId));

  const titleId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<EditDraftPhoto[]>([]);
  const dragIndex = useRef<number | null>(null);
  const ignoreBackdropUntil = useRef(0);
  const today = useMemo(() => currentMonthYear(), []);
  const years = useMemo(() => yearOptions(today.year), [today.year]);

  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState('');
  const [month, setMonth] = useState(today.month);
  const [year, setYear] = useState(today.year);
  const [photos, setPhotos] = useState<EditDraftPhoto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const open = editingId !== null;
  photosRef.current = photos;

  const processing = photos.some((p) => p.source === 'new' && p.status === 'processing');

  const readyPhotos = photos.filter(
    (p): p is EditDraftPhoto & { processed: ProcessedPhoto } =>
      p.source === 'new' && p.status === 'ready' && Boolean(p.processed),
  );

  const revokeNewDraftUrls = useCallback(() => {
    for (const p of photosRef.current) {
      if (p.source === 'new') revokeObjectUrl(`draft:${p.key}`);
    }
  }, []);

  const close = useCallback(() => {
    if (saving || deleting) return;
    setClosing(true);
    window.setTimeout(() => {
      revokeNewDraftUrls();
      setEditingId(null);
      setClosing(false);
    }, 220);
  }, [saving, deleting, revokeNewDraftUrls]);

  // Load collection data from IDB when editing opens
  useEffect(() => {
    if (!editingId || !collection) return;
    setLoaded(false);
    setDeleteConfirm(false);
    setErrors([]);
    setFieldError(null);
    setSaving(false);
    setDeleting(false);
    setDropActive(false);
    setProgress(null);

    const parsed = parseDate(collection.date);
    setTitle(collection.title);
    setMonth(parsed.month);
    setYear(parsed.year);

    void collectionRepository.get(editingId).then((record) => {
      if (getState().editingId !== editingId) return;
      const storedById = new Map((record?.photos ?? []).map((p) => [p.id, p]));
      const drafts: EditDraftPhoto[] = collection.photos.map((photo) => {
        const stored = storedById.get(photo.id);
        const thumbUrl = stored
          ? objectUrlFor(`thumb:${photo.id}`, stored.thumbnailBlob)
          : photo.src;
        return {
          key: photo.id,
          source: 'existing',
          thumbUrl,
          storedPhoto: stored,
        };
      });
      setPhotos(drafts);
      setLoaded(true);
      window.setTimeout(() => titleRef.current?.focus(), 40);
    });
  }, [editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset draft-photo URLs on unmount
  useEffect(() => {
    return () => {
      for (const p of photosRef.current) {
        if (p.source === 'new') revokeObjectUrl(`draft:${p.key}`);
      }
    };
  }, []);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (deleteConfirm) {
          setDeleteConfirm(false);
        } else {
          close();
        }
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, close, deleteConfirm]);

  const pushErrors = useCallback((messages: string[]) => {
    if (!messages.length) return;
    setErrors((cur) => [...cur, ...messages].slice(-6));
  }, []);

  const ingestFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const incoming = copyFiles(fileList);
      if (!incoming.length) return;

      const used = photosRef.current.length;
      const room = MAX_PHOTOS - used;
      if (room <= 0) {
        pushErrors([`A magazine can hold up to ${MAX_PHOTOS} photographs.`]);
        return;
      }
      const overflow = incoming.length > room;
      const accepted = incoming.slice(0, room);
      if (overflow) pushErrors([`A magazine can hold up to ${MAX_PHOTOS} photographs.`]);

      const drafts: EditDraftPhoto[] = accepted.map((file) => ({
        key: crypto.randomUUID(),
        source: 'new',
        thumbUrl: '',
        fileName: file.name,
        status: 'processing',
      }));
      const draftOffset = photosRef.current.length;
      photosRef.current = [...photosRef.current, ...drafts];
      setPhotos(photosRef.current);
      setProgress({ done: 0, total: accepted.length });
      if (fieldError) setFieldError(null);

      await preprocessImageBatch(accepted, {
        orderStart: draftOffset,
        onProgress: (status) => {
          setProgress({ done: status.done, total: status.total });
        },
        onItem: (index, result) => {
          const key = drafts[index]?.key;
          if (!key) return;
          if (!photosRef.current.some((p) => p.key === key)) return;

          if (result.ok) {
            const thumbUrl = objectUrlFor(`draft:${key}`, result.photo.thumbnailBlob);
            setPhotos((cur) =>
              cur.map((p) =>
                p.key === key
                  ? { ...p, status: 'ready', processed: result.photo, thumbUrl, error: undefined }
                  : p,
              ),
            );
            return;
          }

          pushErrors([result.error.message]);
          setPhotos((cur) =>
            cur.map((p) =>
              p.key === key ? { ...p, status: 'error', error: result.error.message } : p,
            ),
          );
        },
      });

      setProgress(null);
    },
    [fieldError, pushErrors],
  );

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const incoming = copyFiles(event.target.files);
    event.target.value = '';
    ignoreBackdropUntil.current = Date.now() + 800;
    if (incoming.length) void ingestFiles(incoming);
  }

  function removePhoto(key: string) {
    setPhotos((cur) => {
      const target = cur.find((p) => p.key === key);
      if (target?.source === 'new') revokeObjectUrl(`draft:${key}`);
      return cur.filter((p) => p.key !== key);
    });
  }

  function onThumbDragStart(index: number) {
    return (event: DragEvent<HTMLLIElement>) => {
      dragIndex.current = index;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    };
  }

  function onThumbDragOver(index: number) {
    return (event: DragEvent<HTMLLIElement>) => {
      if ([...event.dataTransfer.types].includes('Files')) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      const from = dragIndex.current;
      if (from === null || from === index) return;
      setPhotos((cur) => reorder(cur, from, index));
      dragIndex.current = index;
    };
  }

  function onWellDragOver(event: DragEvent<HTMLDivElement>) {
    if (![...event.dataTransfer.types].includes('Files')) return;
    event.preventDefault();
    setDropActive(true);
  }

  function onWellDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropActive(false);
    dragIndex.current = null;
    const incoming = copyFiles(event.dataTransfer.files);
    if (incoming.length) void ingestFiles(incoming);
  }

  async function onSave() {
    const name = title.trim();
    if (!name) {
      setFieldError('Please name this magazine.');
      titleRef.current?.focus();
      return;
    }
    if (processing) return;
    const allReady = photos.filter(
      (p): p is EditDraftPhoto & { storedPhoto: StoredPhoto } =>
        p.source === 'existing' && Boolean(p.storedPhoto),
    );
    const totalValid = allReady.length + readyPhotos.length;
    if (totalValid === 0) {
      setFieldError('Add at least one photograph.');
      return;
    }
    setFieldError(null);
    setSaving(true);

    const entries: EditPhotoEntry[] = photos
      .map((p): EditPhotoEntry | null => {
        if (p.source === 'existing' && p.storedPhoto) {
          return { kind: 'existing', storedPhoto: p.storedPhoto };
        }
        if (p.source === 'new' && p.status === 'ready' && p.processed) {
          return {
            kind: 'new',
            photo: {
              id: p.processed.id,
              imageBlob: p.processed.imageBlob,
              thumbnailBlob: p.processed.thumbnailBlob,
              width: p.processed.width,
              height: p.processed.height,
              originalWidth: p.processed.originalWidth,
              originalHeight: p.processed.originalHeight,
              aspectRatio: p.processed.aspectRatio,
              mimeType: p.processed.mimeType,
              originalName: p.processed.originalName,
              crop: p.processed.crop,
            },
          };
        }
        return null;
      })
      .filter((e): e is EditPhotoEntry => e !== null);

    try {
      if (!editingId) return;
      const updated = await updateUserCollection({
        id: editingId,
        title: name,
        date: formatDate(month, year),
        photos: entries,
      });
      revokeNewDraftUrls();
      updateCollectionInStore(updated);
      setClosing(true);
      window.setTimeout(() => {
        setEditingId(null);
        setClosing(false);
      }, 180);
    } catch {
      setSaving(false);
      setFieldError("Couldn't save changes. Try again.");
    }
  }

  async function onDelete() {
    if (!editingId) return;
    setDeleting(true);
    try {
      const { insertedId, selectedCollectionId } = getState();
      if (insertedId === editingId || selectedCollectionId === editingId) {
        await requestEject();
      }
      await deleteUserCollection(editingId);
      const id = editingId;
      setEditingId(null);
      startDeleting(id);
      // The Cartridge component will call finishDeleting after its exit animation.
      // Provide a safety fallback in case Cartridge isn't mounted.
      window.setTimeout(() => finishDeleting(id), 900);
    } catch {
      setDeleting(false);
      setFieldError("Couldn't delete the magazine. Try again.");
    }
  }

  if (!open && !closing) return null;

  const progressPercent =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const isUserCollection = Boolean(collection?.createdAt);

  return (
    <div
      className={`create-overlay ${closing ? 'is-closing' : ''}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (Date.now() < ignoreBackdropUntil.current) return;
        close();
      }}
    >
      <div
        className="create-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {deleteConfirm ? (
          <div className="edit-delete-confirm">
            <p className="create-kicker">Delete magazine</p>
            <h2 id={titleId}>Remove "{collection?.title}"?</h2>
            <p className="edit-delete-body">
              This will permanently delete the magazine and all its photos. This cannot be undone.
            </p>
            <div className="create-actions">
              <button
                type="button"
                className="create-cancel"
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="edit-delete-confirm-btn"
                onClick={() => void onDelete()}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete magazine'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="create-kicker">Edit magazine</p>
            <h2 id={titleId}>{loaded ? collection?.title ?? 'Edit' : 'Loading…'}</h2>

            {loaded && (
              <>
                <label className="create-field">
                  <span>Collection name</span>
                  <input
                    ref={titleRef}
                    type="text"
                    value={title}
                    maxLength={48}
                    autoComplete="off"
                    onChange={(event) => {
                      setTitle(event.target.value);
                      if (fieldError) setFieldError(null);
                    }}
                  />
                </label>

                <div className="create-field">
                  <span>Date</span>
                  <div className="create-date">
                    <select
                      value={month}
                      aria-label="Month"
                      onChange={(event) => setMonth(Number(event.target.value))}
                    >
                      {MONTHS.map((name, index) => (
                        <option key={name} value={index}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={year}
                      aria-label="Year"
                      onChange={(event) => setYear(Number(event.target.value))}
                    >
                      {years.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="create-field">
                  <span>Photographs</span>
                  <div
                    className={`create-well ${dropActive ? 'is-drop' : ''}`}
                    onDragOver={onWellDragOver}
                    onDragLeave={() => setDropActive(false)}
                    onDrop={onWellDrop}
                  >
                    <div className="create-well-bar">
                      <label
                        className={`create-add ${photos.length >= MAX_PHOTOS || saving ? 'is-disabled' : ''}`}
                      >
                        Add photos
                        <input
                          className="create-file"
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={photos.length >= MAX_PHOTOS || saving}
                          onClick={() => {
                            ignoreBackdropUntil.current = Date.now() + 60_000;
                          }}
                          onChange={onPick}
                        />
                      </label>
                      <em>
                        {photos.length} / {MAX_PHOTOS}
                        {readyPhotos.length > 0 ? ` · ${readyPhotos.length} new` : ''}
                      </em>
                    </div>
                    {photos.length === 0 ? (
                      <p className="create-empty">
                        Drop images here, or choose them from your device. Playback order
                        follows this list.
                      </p>
                    ) : (
                      <ul className="create-thumbs">
                        {photos.map((photo, index) => {
                          const isDraggable =
                            photo.source === 'existing' || photo.status === 'ready';
                          return (
                            <li
                              key={photo.key}
                              className={`create-thumb ${photo.source === 'new' ? (photo.status ?? '') : ''}`}
                              draggable={isDraggable}
                              onDragStart={onThumbDragStart(index)}
                              onDragOver={onThumbDragOver(index)}
                              onDragEnd={() => {
                                dragIndex.current = null;
                              }}
                            >
                              {photo.thumbUrl ? (
                                <img
                                  src={photo.thumbUrl}
                                  alt={photo.fileName ?? `Photo ${index + 1}`}
                                  draggable={false}
                                />
                              ) : (
                                <span className="create-thumb-ph">
                                  {photo.status === 'error' ? '!' : '…'}
                                </span>
                              )}
                              <button
                                type="button"
                                className="create-thumb-remove"
                                aria-label={`Remove photo ${index + 1}`}
                                onClick={() => removePhoto(photo.key)}
                              >
                                ×
                              </button>
                              <span className="create-thumb-index">{index + 1}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {progress && (
                      <p className="create-progress">
                        Preparing photos…
                        <br />
                        {progress.done} / {progress.total}
                        {progress.total > 0 ? ` — ${progressPercent}%` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {fieldError && <p className="create-error">{fieldError}</p>}
                {errors.map((message, index) => (
                  <p key={`${index}:${message}`} className="create-error is-soft">
                    {message}
                  </p>
                ))}

                <div className="edit-actions-row">
                  {isUserCollection && (
                    <button
                      type="button"
                      className="edit-delete-btn"
                      onClick={() => setDeleteConfirm(true)}
                      disabled={saving || deleting}
                    >
                      Delete
                    </button>
                  )}
                  <div className="create-actions">
                    <button
                      type="button"
                      className="create-cancel"
                      onClick={close}
                      disabled={saving || deleting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="create-submit"
                      onClick={() => void onSave()}
                      disabled={saving || processing || deleting}
                    >
                      {saving ? 'Saving…' : processing ? 'Preparing…' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

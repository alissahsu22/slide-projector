import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
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
import { AlbumLayout } from './AlbumLayout';
import { albumSlotCount } from './albumSlots';

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
  const fileRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<EditDraftPhoto[]>([]);
  const dragIndex = useRef<number | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
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
    setSelectedKey(null);

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
      setSelectedKey(drafts[0]?.key ?? null);
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

  // Escape / photo browse
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
        return;
      }
      if (deleteConfirm) return;
      const inField =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement;
      if (inField) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const list = photosRef.current;
      if (!list.length) return;
      event.preventDefault();
      const current = list.findIndex((photo) => photo.key === selectedKey);
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = list[(Math.max(current, 0) + delta + list.length) % list.length];
      if (next) setSelectedKey(next.key);
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, close, deleteConfirm, selectedKey]);

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
        pushErrors([`A tape can hold up to ${MAX_PHOTOS} memories.`]);
        return;
      }
      const overflow = incoming.length > room;
      const accepted = incoming.slice(0, room);
      if (overflow) pushErrors([`A tape can hold up to ${MAX_PHOTOS} memories.`]);

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
      if (!selectedKey) setSelectedKey(drafts[0]?.key ?? null);
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
    [fieldError, pushErrors, selectedKey],
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
      const next = cur.filter((p) => p.key !== key);
      if (selectedKey === key) setSelectedKey(next[next.length - 1]?.key ?? null);
      return next;
    });
  }

  function openPicker() {
    ignoreBackdropUntil.current = Date.now() + 60_000;
    fileRef.current?.click();
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
      setFieldError('Please name this tape.');
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
      setFieldError('Add at least one memory.');
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
      setFieldError("Couldn't save your changes. Try again.");
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
      setFieldError("Couldn't delete this tape. Try again.");
    }
  }

  if (!open && !closing) return null;

  const progressPercent =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const isUserCollection = Boolean(collection?.createdAt);
  const selected =
    photos.find((photo) => photo.key === selectedKey) ?? photos[0] ?? null;
  const slotCount = albumSlotCount(photos.length, MAX_PHOTOS);
  const columns = Math.max(8, Math.ceil(slotCount / 2));
  const canAdd = loaded && photos.length < MAX_PHOTOS && !saving && !deleting;

  return (
    <AlbumLayout
      closing={closing}
      heading="Edit tape"
      titleId={titleId}
      dropActive={dropActive}
      onBackdropMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (Date.now() < ignoreBackdropUntil.current) return;
        close();
      }}
      onDragOver={onWellDragOver}
      onDragLeave={() => setDropActive(false)}
      onDrop={onWellDrop}
      prompts={
        deleteConfirm ? (
          <>
            <button
              type="button"
              className="album-prompt"
              onClick={() => setDeleteConfirm(false)}
              disabled={deleting}
            >
              <span className="album-key is-wide">Esc</span>
              Back
            </button>
            <button
              type="button"
              className="album-prompt is-danger is-primary"
              onClick={() => void onDelete()}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        ) : (
          <>
            {isUserCollection && (
              <button
                type="button"
                className="album-prompt is-danger"
                onClick={() => setDeleteConfirm(true)}
                disabled={saving || deleting || !loaded}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className="album-prompt"
              onClick={close}
              disabled={saving || deleting}
            >
              <span className="album-key is-wide">Esc</span>
              Back
            </button>
            <button
              type="button"
              className="album-prompt is-primary"
              onClick={() => void onSave()}
              disabled={saving || processing || deleting || !loaded}
            >
              {saving ? 'Saving…' : processing ? 'Preparing…' : 'Save'}
            </button>
          </>
        )
      }
      confirm={
        deleteConfirm ? (
          <>
            <h3 className="album-info-title">Delete this tape?</h3>
            <p className="album-confirm-lead">
              “{collection?.title}” and every memory on it will be deleted. This can’t be
              undone.
            </p>
          </>
        ) : undefined
      }
      featured={
        selected?.thumbUrl ? (
          <>
            <img src={selected.thumbUrl} alt={selected.fileName ?? 'Memory'} />
            <button
              type="button"
              className="album-photo-remove"
              aria-label="Remove memory"
              onClick={() => removePhoto(selected.key)}
            >
              ×
            </button>
          </>
        ) : (
          <button
            type="button"
            className="album-photo-empty"
            onClick={openPicker}
            disabled={!canAdd}
          >
            {!loaded ? (
              'Loading…'
            ) : canAdd ? (
              <>
                <span className="album-photo-empty-title">+ Add memories</span>
                <span className="album-photo-empty-sub">Choose photos, or drop them here</span>
              </>
            ) : (
              'This tape is full'
            )}
          </button>
        )
      }
      info={
        <>
          <h3 className="album-info-title">Details</h3>
          <label className="album-row">
            <span>Name</span>
            <input
              ref={titleRef}
              type="text"
              value={title}
              maxLength={48}
              placeholder="Name this tape"
              autoComplete="off"
              disabled={!loaded}
              onChange={(event) => {
                setTitle(event.target.value);
                if (fieldError) setFieldError(null);
              }}
            />
          </label>
          <div className="album-row">
            <span>Date</span>
            <div className="album-date">
              <select
                value={month}
                aria-label="Month"
                disabled={!loaded}
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
                disabled={!loaded}
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
          <div className="album-row">
            <span>Memories</span>
            <em>
              {photos.length} / {MAX_PHOTOS}
              {readyPhotos.length > 0 ? ` · ${readyPhotos.length} new` : ''}
            </em>
          </div>
          {progress && (
            <p className="album-note">
              Preparing… {progress.done} / {progress.total}
              {progress.total > 0 ? ` — ${progressPercent}%` : ''}
            </p>
          )}
          {fieldError && <p className="album-note is-error">{fieldError}</p>}
          {errors.map((message, index) => (
            <p key={`${index}:${message}`} className="album-note is-error">
              {message}
            </p>
          ))}
        </>
      }
      strip={
        <div className="album-thumbs-wrap">
          <input
            ref={fileRef}
            className="create-file"
            type="file"
            accept="image/*"
            multiple
            disabled={!canAdd}
            onChange={onPick}
          />
          <ul
            className="album-thumbs"
            style={
                {
                  gridTemplateColumns: `repeat(${columns}, minmax(4.05rem, 1fr))`,
                  '--rows': slotCount > columns ? 2 : 1,
                } as CSSProperties
              }
          >
            {Array.from({ length: slotCount }, (_, index) => {
              const photo = photos[index];
              if (!photo) {
                return (
                  <li key={`empty-${index}`} className="album-thumb is-empty">
                    <button
                      type="button"
                      disabled={!canAdd}
                      onClick={openPicker}
                      aria-label="Add more memories"
                    >
                      +
                    </button>
                  </li>
                );
              }
              const isSelected = (selected?.key ?? null) === photo.key;
              const isDraggable = photo.source === 'existing' || photo.status === 'ready';
              return (
                <li
                  key={photo.key}
                  className={`album-thumb ${photo.source === 'new' ? (photo.status ?? '') : ''} ${isSelected ? 'is-selected' : ''}`}
                  draggable={isDraggable}
                  onClick={() => setSelectedKey(photo.key)}
                  onDragStart={onThumbDragStart(index)}
                  onDragOver={onThumbDragOver(index)}
                  onDragEnd={() => {
                    dragIndex.current = null;
                  }}
                >
                  {photo.thumbUrl ? (
                    <img
                      src={photo.thumbUrl}
                      alt={photo.fileName ?? `Memory ${index + 1}`}
                      draggable={false}
                    />
                  ) : (
                    <span className="album-thumb-ph">
                      {photo.status === 'error' ? 'Error' : '…'}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      }
    />
  );
}

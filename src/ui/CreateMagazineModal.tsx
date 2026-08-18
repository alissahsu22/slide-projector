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
import { MAX_PHOTOS } from '../lib/images/imageConfig';
import { preprocessImageBatch } from '../lib/images/preprocessImages';
import type { ProcessedPhoto } from '../lib/images/types';
import { objectUrlFor, revokeObjectUrl } from '../media/objectUrls';
import { persistUserCollection } from '../storage/collectionService';
import { addArrivingCollection, setCreateOpen } from '../state/store';

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

type DraftPhoto = {
  key: string;
  fileName: string;
  status: 'processing' | 'ready' | 'error';
  error?: string;
  processed?: ProcessedPhoto;
  thumbUrl?: string;
};

function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth(), year: now.getFullYear() };
}

function formatDate(month: number, year: number): string {
  return `${MONTHS[month] ?? 'January'} ${year}`;
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

type Props = {
  open: boolean;
};

export function CreateMagazineModal({ open }: Props) {
  const titleId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<DraftPhoto[]>([]);
  const dragIndex = useRef<number | null>(null);
  const ignoreBackdropUntil = useRef(0);
  const today = useMemo(() => currentMonthYear(), []);
  const years = useMemo(() => yearOptions(today.year), [today.year]);

  const [title, setTitle] = useState('');
  const [month, setMonth] = useState(today.month);
  const [year, setYear] = useState(today.year);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  photosRef.current = photos;
  const processing = photos.some((photo) => photo.status === 'processing');
  const readyPhotos = photos.filter(
    (photo): photo is DraftPhoto & { processed: ProcessedPhoto } =>
      photo.status === 'ready' && Boolean(photo.processed),
  );

  const reset = useCallback(() => {
    for (const photo of photosRef.current) {
      if (photo.thumbUrl) revokeObjectUrl(`draft:${photo.key}`);
    }
    const stamp = currentMonthYear();
    setTitle('');
    setMonth(stamp.month);
    setYear(stamp.year);
    setPhotos([]);
    setErrors([]);
    setFieldError(null);
    setSaving(false);
    setProgress(null);
    setDropActive(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setClosing(false);
    const id = window.setTimeout(() => titleRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (open) return;
    reset();
  }, [open, reset]);

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) {
        if (photo.thumbUrl) revokeObjectUrl(`draft:${photo.key}`);
      }
    };
  }, []);

  const close = useCallback(() => {
    if (saving) return;
    setClosing(true);
    window.setTimeout(() => {
      setCreateOpen(false);
      setClosing(false);
    }, 220);
  }, [saving]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  const pushErrors = useCallback((messages: string[]) => {
    if (!messages.length) return;
    setErrors((current) => [...current, ...messages].slice(-6));
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
      if (overflow) {
        pushErrors([`A magazine can hold up to ${MAX_PHOTOS} photographs.`]);
      }

      const drafts: DraftPhoto[] = accepted.map((file) => ({
        key: crypto.randomUUID(),
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
          if (!photosRef.current.some((photo) => photo.key === key)) return;

          if (result.ok) {
            const thumbUrl = objectUrlFor(`draft:${key}`, result.photo.thumbnailBlob);
            setPhotos((current) =>
              current.map((photo) =>
                photo.key === key
                  ? {
                      ...photo,
                      status: 'ready',
                      processed: result.photo,
                      thumbUrl,
                      error: undefined,
                    }
                  : photo,
              ),
            );
            return;
          }

          pushErrors([result.error.message]);
          setPhotos((current) =>
            current.map((photo) =>
              photo.key === key
                ? { ...photo, status: 'error', error: result.error.message }
                : photo,
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
    setPhotos((current) => {
      const target = current.find((photo) => photo.key === key);
      if (target?.thumbUrl) revokeObjectUrl(`draft:${key}`);
      return current.filter((photo) => photo.key !== key);
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
      setPhotos((current) => reorder(current, from, index));
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

  async function onCreate() {
    const name = title.trim();
    if (!name) {
      setFieldError('Please name this magazine.');
      titleRef.current?.focus();
      return;
    }
    if (processing) return;
    if (!readyPhotos.length) {
      setFieldError('Add at least one photograph.');
      return;
    }
    setFieldError(null);
    setSaving(true);
    try {
      const collection = await persistUserCollection({
        title: name,
        date: formatDate(month, year),
        photos: readyPhotos.map((photo) => ({
          id: photo.processed.id,
          imageBlob: photo.processed.imageBlob,
          thumbnailBlob: photo.processed.thumbnailBlob,
          width: photo.processed.width,
          height: photo.processed.height,
          originalWidth: photo.processed.originalWidth,
          originalHeight: photo.processed.originalHeight,
          aspectRatio: photo.processed.aspectRatio,
          mimeType: photo.processed.mimeType,
          originalName: photo.processed.originalName,
          crop: photo.processed.crop,
        })),
      });
      setClosing(true);
      addArrivingCollection(collection);
      window.setTimeout(() => {
        setCreateOpen(false);
        setClosing(false);
      }, 180);
    } catch {
      setSaving(false);
      setFieldError("Couldn't save this magazine on this device. Try again.");
    }
  }

  if (!open && !closing) return null;

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

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
        <p className="create-kicker">New magazine</p>
        <h2 id={titleId}>Load a roll of photographs</h2>

        <label className="create-field">
          <span>Collection name</span>
          <input
            ref={titleRef}
            type="text"
            value={title}
            maxLength={48}
            placeholder="Thailand"
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
                {readyPhotos.length !== photos.length
                  ? ` · ${readyPhotos.length} ready`
                  : ''}
              </em>
            </div>
            {photos.length === 0 ? (
              <p className="create-empty">
                Drop images here, or choose them from your device. Playback order
                follows this list.
              </p>
            ) : (
              <ul className="create-thumbs">
                {photos.map((photo, index) => (
                  <li
                    key={photo.key}
                    className={`create-thumb ${photo.status}`}
                    draggable={photo.status === 'ready'}
                    onDragStart={onThumbDragStart(index)}
                    onDragOver={onThumbDragOver(index)}
                    onDragEnd={() => {
                      dragIndex.current = null;
                    }}
                  >
                    {photo.thumbUrl ? (
                      <img src={photo.thumbUrl} alt={photo.fileName} draggable={false} />
                    ) : (
                      <span className="create-thumb-ph">
                        {photo.status === 'error' ? '!' : '…'}
                      </span>
                    )}
                    <button
                      type="button"
                      className="create-thumb-remove"
                      aria-label={`Remove ${photo.fileName}`}
                      onClick={() => removePhoto(photo.key)}
                    >
                      ×
                    </button>
                    <span className="create-thumb-index">{index + 1}</span>
                  </li>
                ))}
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

        <div className="create-actions">
          <button type="button" className="create-cancel" onClick={close} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="create-submit"
            onClick={() => void onCreate()}
            disabled={saving || processing}
          >
            {saving ? 'Saving…' : processing ? 'Preparing…' : 'Create magazine'}
          </button>
        </div>
      </div>
    </div>
  );
}

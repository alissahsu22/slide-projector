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
import { MAX_PHOTOS } from '../lib/images/imageConfig';
import { preprocessImageBatch } from '../lib/images/preprocessImages';
import type { ProcessedPhoto } from '../lib/images/types';
import { objectUrlFor, revokeObjectUrl } from '../media/objectUrls';
import { persistUserCollection } from '../storage/collectionService';
import { addArrivingCollection, setCreateOpen } from '../state/store';
import { AlbumLayout, albumSlotCount } from './AlbumLayout';

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
  const fileRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLButtonElement>(null);
  const photosRef = useRef<DraftPhoto[]>([]);
  const dragIndex = useRef<number | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
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
    setSelectedKey(null);
    setErrors([]);
    setFieldError(null);
    setSaving(false);
    setProgress(null);
    setDropActive(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setClosing(false);
    // Choosing photos is the first thing to do, so it takes focus first.
    const id = window.setTimeout(() => pickRef.current?.focus(), 40);
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
        return;
      }
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
  }, [open, close, selectedKey]);

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
        pushErrors([`A tape can hold up to ${MAX_PHOTOS} memories.`]);
        return;
      }

      const overflow = incoming.length > room;
      const accepted = incoming.slice(0, room);
      if (overflow) {
        pushErrors([`A tape can hold up to ${MAX_PHOTOS} memories.`]);
      }

      const drafts: DraftPhoto[] = accepted.map((file) => ({
        key: crypto.randomUUID(),
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
    [fieldError, pushErrors, selectedKey],
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
      const next = current.filter((photo) => photo.key !== key);
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
      setFieldError('Please name this tape.');
      titleRef.current?.focus();
      return;
    }
    if (processing) return;
    if (!readyPhotos.length) {
      setFieldError('Add at least one memory.');
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
      setFieldError("Couldn't save this tape on this device. Try again.");
    }
  }

  if (!open && !closing) return null;

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;
  const selected =
    photos.find((photo) => photo.key === selectedKey) ?? photos[0] ?? null;
  const slotCount = albumSlotCount(photos.length, MAX_PHOTOS);
  const columns = Math.max(8, Math.ceil(slotCount / 2));
  const canAdd = photos.length < MAX_PHOTOS && !saving;
  const missing = [
    !title.trim() && 'a name',
    readyPhotos.length === 0 && !processing && 'at least one photo',
  ].filter((item): item is string => Boolean(item));

  return (
    <AlbumLayout
      closing={closing}
      heading="Add a tape"
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
        <>
          <button type="button" className="album-prompt" onClick={close} disabled={saving}>
            <span className="album-key is-wide">Esc</span>
            Back
          </button>
          <button
            type="button"
            className="album-prompt is-primary"
            onClick={() => void onCreate()}
            disabled={saving || processing || missing.length > 0}
            aria-describedby={missing.length > 0 ? 'create-missing' : undefined}
          >
            {saving ? 'Saving…' : processing ? 'Preparing…' : 'Add tape'}
          </button>
        </>
      }
      featured={
        <>
          <input
            ref={fileRef}
            className="create-file"
            type="file"
            accept="image/*"
            multiple
            disabled={!canAdd}
            onChange={onPick}
            aria-label="Choose photos"
          />
          {selected?.thumbUrl ? (
            <>
              <img src={selected.thumbUrl} alt={selected.fileName} />
              <button
                type="button"
                className="album-photo-remove"
                aria-label={`Remove ${selected.fileName}`}
                onClick={() => removePhoto(selected.key)}
              >
                ×
              </button>
            </>
          ) : (
            <button
              ref={pickRef}
              type="button"
              className="album-photo-empty"
              onClick={openPicker}
              disabled={!canAdd}
            >
              {canAdd ? (
                <>
                  <span className="album-photo-empty-title">+ Add memories</span>
                  <span className="album-photo-empty-sub">Choose photos, or drop them here</span>
                </>
              ) : (
                'This tape is full'
              )}
            </button>
          )}
        </>
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
          <div className="album-row">
            <span>Memories</span>
            <em>
              {photos.length} / {MAX_PHOTOS}
              {readyPhotos.length !== photos.length
                ? ` · ${readyPhotos.length} ready`
                : ''}
            </em>
          </div>
          {progress && (
            <p className="album-note">
              Preparing… {progress.done} / {progress.total}
              {progress.total > 0 ? ` — ${progressPercent}%` : ''}
            </p>
          )}
          {missing.length > 0 && !progress && (
            <p className="album-note" id="create-missing">
              To add this tape, give it {missing.join(' and ')}.
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
        photos.length === 0 ? undefined : (
          <div className="album-thumbs-wrap">
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
                return (
                  <li
                    key={photo.key}
                    className={`album-thumb ${photo.status} ${isSelected ? 'is-selected' : ''}`}
                    draggable={photo.status === 'ready'}
                    onClick={() => setSelectedKey(photo.key)}
                    onDragStart={onThumbDragStart(index)}
                    onDragOver={onThumbDragOver(index)}
                    onDragEnd={() => {
                      dragIndex.current = null;
                    }}
                  >
                    {photo.thumbUrl ? (
                      <img src={photo.thumbUrl} alt={photo.fileName} draggable={false} />
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
        )
      }
    />
  );
}

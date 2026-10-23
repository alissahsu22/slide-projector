import { Component, useEffect, useState, type ReactNode } from 'react';
import { markWebGLFailed } from './sceneStatus';
import { persistSlide, rememberedSlide, setCreateOpen, useExperience } from '../state/store';

type BoundaryProps = {
  children: ReactNode;
  onFail: () => void;
};

type BoundaryState = { failed: boolean };

export class SceneBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.props.onFail();
  }

  render(): ReactNode {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function memoryLabel(count: number): string {
  return `${count} ${count === 1 ? 'memory' : 'memories'}`;
}

/** Flat tape browser used when the 3D room cannot start. */
export function SceneFallback() {
  const collections = useExperience((s) => s.collections);
  const [tapeId, setTapeId] = useState<string | null>(collections[0]?.id ?? null);
  const [index, setIndex] = useState(() =>
    collections[0] ? rememberedSlide(collections[0].id) : 0,
  );
  const [broken, setBroken] = useState(false);
  const tape = collections.find((c) => c.id === tapeId) ?? collections[0] ?? null;

  useEffect(() => {
    if (!tape) return;
    persistSlide(tape.id, index);
  }, [tape, index]);

  const total = tape?.photos.length ?? 0;
  const photo = tape?.photos[index];

  function choose(id: string) {
    setTapeId(id);
    setIndex(rememberedSlide(id));
    setBroken(false);
  }

  function step(direction: -1 | 1) {
    setBroken(false);
    setIndex((current) => Math.max(0, Math.min(total - 1, current + direction)));
  }

  return (
    <section
      className="fallback"
      aria-label="Tapes"
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement
        ) {
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          step(1);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          step(-1);
        }
      }}
    >
      <div className="fallback-copy">
        <h1>The room couldn’t open</h1>
        <p>
          This browser couldn’t start the 3D scene. You can still choose a tape and
          look through its memories.
        </p>
      </div>
      {collections.length === 0 ? (
        <div className="fallback-empty">
          <p>No tapes yet. Add one to start your collection.</p>
          <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
            Add tape
          </button>
        </div>
      ) : (
        <>
          <div className="fallback-tapes" role="listbox" aria-label="Tapes">
            {collections.map((collection) => {
              const selected = collection.id === tape?.id;
              return (
                <button
                  key={collection.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`fallback-tape ${selected ? 'is-selected' : ''}`}
                  onClick={() => choose(collection.id)}
                >
                  <span>{collection.title}</span>
                  <span className="fallback-tape-meta">
                    {collection.date ? `${collection.date} · ` : ''}
                    {memoryLabel(collection.photos.length)}
                  </span>
                </button>
              );
            })}
          </div>
          {tape && photo && (
            <div className="fallback-viewer">
              <div className="fallback-meta">
                <h2>{tape.title}</h2>
                <p>
                  {tape.date ? `${tape.date} · ` : ''}
                  {index + 1} of {total}
                </p>
              </div>
              <div
                className="fallback-frame"
                style={{
                  aspectRatio:
                    photo.width && photo.height ? `${photo.width} / ${photo.height}` : '4 / 3',
                }}
              >
                {broken ? (
                  <p className="fallback-error">This memory couldn’t load.</p>
                ) : (
                  <img
                    key={photo.src}
                    src={photo.src}
                    alt={`${tape.title}, memory ${index + 1} of ${total}`}
                    onError={() => setBroken(true)}
                  />
                )}
              </div>
              <div className="fallback-nav">
                <button type="button" disabled={index <= 0} onClick={() => step(-1)}>
                  Previous
                </button>
                <button type="button" disabled={index >= total - 1} onClick={() => step(1)}>
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function ExperienceFrame({
  children,
  failed,
  onFail,
}: {
  children: ReactNode;
  failed: boolean;
  onFail: () => void;
}) {
  useEffect(() => {
    if (failed) markWebGLFailed();
  }, [failed]);

  if (failed) return <SceneFallback />;
  return <SceneBoundary onFail={onFail}>{children}</SceneBoundary>;
}

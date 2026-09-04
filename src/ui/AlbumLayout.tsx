import type { DragEvent, MouseEvent, ReactNode } from 'react';

/** Two-row album strip: at least 16 slots (2×8), always even, plus an empty add slot. */
export function albumSlotCount(filled: number, max: number): number {
  if (filled >= max) return filled + (filled % 2);
  const padded = Math.max(16, filled + 1);
  return padded + (padded % 2);
}

type Props = {
  closing: boolean;
  titleId: string;
  dropActive: boolean;
  onBackdropMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  prompts: ReactNode;
  featured: ReactNode;
  info: ReactNode;
  strip: ReactNode;
  confirm?: ReactNode;
};

export function AlbumLayout({
  closing,
  titleId,
  dropActive,
  onBackdropMouseDown,
  onDragOver,
  onDragLeave,
  onDrop,
  prompts,
  featured,
  info,
  strip,
  confirm,
}: Props) {
  return (
    <div
      className={`create-overlay album-overlay ${closing ? 'is-closing' : ''} ${dropActive ? 'is-drop' : ''}`}
      role="presentation"
      onMouseDown={onBackdropMouseDown}
    >
      <div
        className="album"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
        onDragOver={onDragOver}
        onDragLeave={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && event.currentTarget.contains(next)) return;
          onDragLeave();
        }}
        onDrop={onDrop}
      >
        <header className="album-chrome">
          <h2 className="album-title" id={titleId}>
            Album
          </h2>
          <div className="album-prompts">{prompts}</div>
        </header>

        <div className="album-page">
          {confirm ? (
            <div className="album-confirm">{confirm}</div>
          ) : (
            <>
              <div className="album-stage">
                <div className="album-frame">
                  <div className="album-frame-inner">{featured}</div>
                </div>
                <div className="album-info">{info}</div>
              </div>
              <div className="album-strip">{strip}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

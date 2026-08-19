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
      <svg className="album-defs" aria-hidden="true" focusable="false">
        <filter id="album-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>
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
          <div className="album-page-grain" />
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
              <div className="album-strip">
                <AlbumSpiral />
                {strip}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AlbumSpiral() {
  const coils = Array.from({ length: 8 }, (_, i) => i);
  return (
    <svg
      className="album-spiral"
      viewBox="0 0 44 224"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {coils.map((i) => {
        const cy = 16 + i * 27;
        return (
          <g key={i}>
            <circle cx="22" cy={cy} r="6.2" fill="#1b1916" />
            <circle cx="22" cy={cy} r="3.4" fill="#cfc8ba" />
            <ellipse
              cx="18"
              cy={cy}
              rx="15"
              ry="9.5"
              fill="none"
              stroke="#0e0d0c"
              strokeWidth="2.35"
            />
            <ellipse
              cx="19"
              cy={cy - 0.8}
              rx="15"
              ry="9.5"
              fill="none"
              stroke="#3d3a36"
              strokeWidth="0.7"
            />
          </g>
        );
      })}
    </svg>
  );
}

import { useRef, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import { useDialogFocus } from './useDialogFocus';

type Props = {
  closing: boolean;
  titleId: string;
  dropActive: boolean;
  onBackdropMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  heading: string;
  prompts: ReactNode;
  featured: ReactNode;
  info: ReactNode;
  /** Omitted until there is something to show in it. */
  strip?: ReactNode;
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
  heading,
  prompts,
  featured,
  info,
  strip,
  confirm,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef);

  return (
    <div
      className={`create-overlay album-overlay ${closing ? 'is-closing' : ''} ${dropActive ? 'is-drop' : ''}`}
      role="presentation"
      onMouseDown={onBackdropMouseDown}
    >
      <div
        ref={dialogRef}
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
            {heading}
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
              {strip && <div className="album-strip">{strip}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

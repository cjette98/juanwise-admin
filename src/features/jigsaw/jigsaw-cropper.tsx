import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button, Field } from '@/shared/components/ui';

/**
 * Turns any picture into the square the game actually plays.
 *
 * The jigsaw board is square, so a 16:9 photo loses its left and right edges —
 * which is invisible until a student is staring at half a face. Rather than ask
 * an admin to pre-crop in another program, the square is chosen here and the
 * *upload itself* is square, so nothing downstream has to crop and the preview
 * cannot disagree with the game.
 *
 * Two ways to resolve the mismatch:
 *
 *   Fill  — the picture covers the square and the rest is cut. Drag to choose
 *           which part survives; zoom to change how much of it fits.
 *   Fit   — the whole picture is kept, and the leftover space is filled with a
 *           blurred copy of it rather than flat bars, which reads as a
 *           deliberate backdrop instead of a mistake.
 */

/** The exported square. 1024 is plenty for a board that renders at ~320 CSS px. */
const OUTPUT_SIZE = 1024;
/** The on-screen editing square. */
const VIEWPORT = 320;
const JPEG_QUALITY = 0.9;

type Mode = 'fill' | 'fit';

interface Placement {
  scale: number;
  x: number;
  y: number;
}

export default function JigsawCropper({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (square: File) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<Mode>('fill');
  const [placement, setPlacement] = useState<Placement>({ scale: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  const drag = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);

    const img = new Image();
    img.onload = () => setImage(img);
    img.src = objectUrl;

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const coverScale = image ? Math.max(VIEWPORT / image.width, VIEWPORT / image.height) : 1;
  const fitScale = image ? Math.min(VIEWPORT / image.width, VIEWPORT / image.height) : 1;

  // Re-centre whenever the mode changes: "fill" starts covering the square,
  // "fit" starts with the whole picture inside it.
  useEffect(() => {
    if (!image) return;
    const scale = mode === 'fill' ? coverScale : fitScale;
    setPlacement({
      scale,
      x: (VIEWPORT - image.width * scale) / 2,
      y: (VIEWPORT - image.height * scale) / 2,
    });
  }, [image, mode, coverScale, fitScale]);

  /** In fill mode the square must stay covered, so the picture cannot be dragged off it. */
  const clamp = (next: Placement): Placement => {
    if (!image || mode === 'fit') return next;
    const width = image.width * next.scale;
    const height = image.height * next.scale;
    return {
      ...next,
      x: Math.min(0, Math.max(VIEWPORT - width, next.x)),
      y: Math.min(0, Math.max(VIEWPORT - height, next.y)),
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mode === 'fit') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: placement.x,
      originY: placement.y,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    setPlacement((current) =>
      clamp({
        ...current,
        x: state.originX + (event.clientX - state.startX),
        y: state.originY + (event.clientY - state.startY),
      }),
    );
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const setScale = (scale: number) => {
    if (!image) return;
    setPlacement((current) => {
      // Zoom around the middle of the square rather than the corner, so the
      // thing the admin centred stays centred.
      const ratio = scale / current.scale;
      return clamp({
        scale,
        x: VIEWPORT / 2 - (VIEWPORT / 2 - current.x) * ratio,
        y: VIEWPORT / 2 - (VIEWPORT / 2 - current.y) * ratio,
      });
    });
  };

  const confirm = async () => {
    if (!image) return;
    setBusy(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('This browser cannot prepare the image.');

      const k = OUTPUT_SIZE / VIEWPORT;

      if (mode === 'fit') {
        // A blurred, zoomed copy behind the picture — better than flat bars, and
        // it keeps the puzzle pieces at the edges from being featureless.
        const bgScale = Math.max(OUTPUT_SIZE / image.width, OUTPUT_SIZE / image.height) * 1.2;
        const bgWidth = image.width * bgScale;
        const bgHeight = image.height * bgScale;
        ctx.filter = 'blur(24px)';
        ctx.drawImage(
          image,
          (OUTPUT_SIZE - bgWidth) / 2,
          (OUTPUT_SIZE - bgHeight) / 2,
          bgWidth,
          bgHeight,
        );
        ctx.filter = 'none';
      }

      ctx.drawImage(
        image,
        placement.x * k,
        placement.y * k,
        image.width * placement.scale * k,
        image.height * placement.scale * k,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
      );
      if (!blob) throw new Error('The image could not be prepared.');

      const name = file.name.replace(/\.[^.]+$/, '') || 'puzzle';
      onConfirm(new File([blob], `${name}-square.jpg`, { type: 'image/jpeg' }));
    } finally {
      setBusy(false);
    }
  };

  const maxScale = coverScale * 3;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div>
        <div className="field__label">Choose the square</div>
        <div className="field__hint">
          The board is square, so this is exactly what a student will see.
        </div>
      </div>

      <div className="pill-tabs" style={{ alignSelf: 'start' }}>
        <button
          className={`pill-tab ${mode === 'fill' ? 'pill-tab--active' : ''}`}
          onClick={() => setMode('fill')}
        >
          Fill square
        </button>
        <button
          className={`pill-tab ${mode === 'fit' ? 'pill-tab--active' : ''}`}
          onClick={() => setMode('fit')}
        >
          Fit whole picture
        </button>
      </div>

      <div
        className="cropper"
        style={{ width: VIEWPORT, height: VIEWPORT, cursor: mode === 'fill' ? 'grab' : 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {url && image && (
          <>
            {mode === 'fit' && (
              <img src={url} alt="" className="cropper__backdrop" aria-hidden />
            )}
            <img
              src={url}
              alt="The picture being cropped"
              draggable={false}
              style={{
                position: 'absolute',
                left: placement.x,
                top: placement.y,
                width: image.width * placement.scale,
                height: image.height * placement.scale,
              }}
            />
          </>
        )}
        <div className="cropper__grid" aria-hidden />
      </div>

      {mode === 'fill' && (
        <Field label="Zoom" hint="Drag the picture to choose which part of it survives the crop.">
          <input
            type="range"
            min={coverScale}
            max={maxScale}
            step={(maxScale - coverScale) / 100 || 0.01}
            value={placement.scale}
            onChange={(e) => setScale(Number(e.target.value))}
            style={{ width: VIEWPORT }}
          />
        </Field>
      )}

      {mode === 'fit' && (
        <p className="field__hint" style={{ maxWidth: VIEWPORT }}>
          Nothing is cut. The space around the picture is filled with a blurred copy of it, so the
          outer puzzle pieces still have something on them.
        </p>
      )}

      <div className="row">
        <Button onClick={confirm} busy={busy}>
          Use this picture
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

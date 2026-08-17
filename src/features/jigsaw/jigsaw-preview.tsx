import { useMemo, useState } from 'react';
import type { ApiJigsawPieceCount } from '@/shared/api';
import { generateEdgeMap, getPieceEdges, piecePathD } from './jigsaw-shapes';

/**
 * The picture, cut the way the game will cut it.
 *
 * The geometry is the game's: juanwise-app-v2 `jigsaw-puzzle-screen.tsx` picks
 * the grid from the piece count, gives every piece a canvas 38% larger than its
 * cell so its tabs have room, and clips the whole board image through the piece
 * path — offset so each piece shows its own part of the picture. Reproducing
 * that here (rather than drawing plain rectangles) is the point of the preview:
 * an admin can see that a face or a flag is not about to be sliced apart before
 * the picture reaches a single player.
 */

/** juanwise-app-v2 `jigsaw-puzzle-screen.tsx` `getGrid`. */
function getGrid(pieceCount: number) {
  if (pieceCount === 6) return { rows: 2, cols: 3 };
  if (pieceCount === 9) return { rows: 3, cols: 3 };
  return { rows: 3, cols: 4 };
}

export const PIECE_COUNTS: { count: ApiJigsawPieceCount; label: string }[] = [
  { count: 6, label: '6 pieces · Easy' },
  { count: 9, label: '9 pieces · Medium' },
  { count: 12, label: '12 pieces · Hard' },
];

/**
 * The cut an activity plays when the admin has not chosen one.
 *
 * juanwise-app-v2 `activity-list-screen.tsx` `getPieceCount` — the ramp the
 * game applied across a level's six activities before the console could set
 * this. Leaving an activity unset keeps it, which is why the picker offers a
 * "Default" entry rather than pre-filling 6 everywhere.
 */
export function defaultPieceCount(activityNum: number): ApiJigsawPieceCount {
  if (activityNum <= 2) return 6;
  if (activityNum <= 4) return 9;
  return 12;
}

const BOARD = 320;

export default function JigsawPreview({
  imageUrl,
  pieceCount,
}: {
  imageUrl: string;
  pieceCount: number;
}) {
  const { rows, cols } = getGrid(pieceCount);
  const [seed, setSeed] = useState(0);

  const pieceWidth = BOARD / cols;
  const pieceHeight = BOARD / rows;
  // Same margins as the game: extra canvas room so tabs can poke outside the cell.
  const marginX = pieceHeight * 0.38;
  const marginY = pieceWidth * 0.38;

  // Which internal edges are tabs and which are blanks is random per attempt in
  // the game, so it is random per preview here too — `seed` re-rolls it.
  const pieces = useMemo(() => {
    const edgeMap = generateEdgeMap(rows, cols);
    const out: { id: string; d: string; row: number; col: number }[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        out.push({
          id: `${seed}-${row}-${col}`,
          d: piecePathD(
            pieceWidth,
            pieceHeight,
            marginX,
            marginY,
            getPieceEdges(edgeMap, rows, cols, row, col),
          ),
          row,
          col,
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols, pieceWidth, pieceHeight, marginX, marginY, seed]);

  // Room in the viewBox for the tabs on the outermost pieces, which reach
  // beyond the board's own square.
  const pad = Math.max(marginX, marginY);

  return (
    <div>
      <svg
        className="jigsaw-preview"
        viewBox={`${-pad} ${-pad} ${BOARD + pad * 2} ${BOARD + pad * 2}`}
        role="img"
        aria-label={`Puzzle preview, ${rows} by ${cols} pieces`}
      >
        <defs>
          {pieces.map((piece) => (
            <clipPath key={piece.id} id={`clip-${piece.id}`}>
              <path d={piece.d} />
            </clipPath>
          ))}
        </defs>

        {pieces.map((piece) => {
          // The piece's own canvas is `margin` larger than its cell on every
          // side, so shift it back by that much to land the flat rectangle on
          // the cell it belongs to.
          const x = piece.col * pieceWidth - marginX;
          const y = piece.row * pieceHeight - marginY;

          return (
            <g key={piece.id} transform={`translate(${x} ${y})`}>
              <g clipPath={`url(#clip-${piece.id})`}>
                <image
                  href={imageUrl}
                  x={marginX - piece.col * pieceWidth}
                  y={marginY - piece.row * pieceHeight}
                  width={BOARD}
                  height={BOARD}
                  preserveAspectRatio="xMidYMid slice"
                />
              </g>
              <path d={piece.d} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={1.4} />
            </g>
          );
        })}
      </svg>

      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn btn--ghost btn--sm" onClick={() => setSeed((s) => s + 1)}>
          ↻ Re-cut
        </button>
        <span className="field__hint">
          {rows} × {cols} grid — tabs and blanks are randomised on every attempt, exactly as in the
          game.
        </span>
      </div>
    </div>
  );
}

// jigsaw-shapes.ts
//
// A byte-for-byte copy of juanwise-app-v2
// `src/features/jigsaw/lib/jigsaw-shapes.ts`, apart from this note. It is plain
// TypeScript with no React Native imports, and the console's puzzle preview has
// to cut the picture exactly the way the game will — a preview drawn with a
// second, "close enough" implementation would quietly stop matching the game
// the first time either side was tuned. If you change one, change both.
//
// Generates real interlocking jigsaw-piece outlines (tabs + blanks) as SVG
// path strings, for any rows x cols grid. Each internal edge between two
// neighboring cells is randomly assigned a "tab" (bump out) or "blank"
// (notch in); the two pieces sharing that edge always get matching,
// opposite-facing shapes so they interlock correctly.

export type EdgeType = -1 | 0 | 1; // 0 = flat/border, 1 = tab (bulges out), -1 = blank (notch in)

export type EdgeMap = {
  // horiz[r][c]: edge between row r and row r+1, at column c (r: 0..rows-2)
  horiz: EdgeType[][];
  // vert[r][c]: edge between col c and col c+1, at row r (c: 0..cols-2)
  vert: EdgeType[][];
};

export function generateEdgeMap(rows: number, cols: number): EdgeMap {
  const horiz: EdgeType[][] = [];
  for (let r = 0; r < rows - 1; r++) {
    const row: EdgeType[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(Math.random() < 0.5 ? 1 : -1);
    }
    horiz.push(row);
  }
  const vert: EdgeType[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: EdgeType[] = [];
    for (let c = 0; c < cols - 1; c++) {
      row.push(Math.random() < 0.5 ? 1 : -1);
    }
    vert.push(row);
  }
  return { horiz, vert };
}

export type PieceEdges = { top: EdgeType; right: EdgeType; bottom: EdgeType; left: EdgeType };

// Piece(row,col) "owns" the tab/blank direction for its right & bottom
// edges directly from the map; its top/left edges are the inverse of the
// neighboring piece's bottom/right, so the two shapes always mesh.
export function getPieceEdges(map: EdgeMap, rows: number, cols: number, row: number, col: number): PieceEdges {
  const top: EdgeType = row === 0 ? 0 : (-map.horiz[row - 1][col] as EdgeType);
  const bottom: EdgeType = row === rows - 1 ? 0 : map.horiz[row][col];
  const left: EdgeType = col === 0 ? 0 : (-map.vert[row][col - 1] as EdgeType);
  const right: EdgeType = col === cols - 1 ? 0 : map.vert[row][col];
  return { top, right, bottom, left };
}

type Pt = { x: number; y: number };

// Catmull-Rom -> cubic Bezier conversion for a smooth curve through a set
// of points (open curve, clamped end tangents). Returns SVG path command
// fragments ("C x1 y1, x2 y2, x y ...") to be appended after an initial
// "M"/"L" to the first point.
function catmullRomToBezierCommands(points: Pt[]): string {
  if (points.length < 2) return '';
  const pts = [points[0], ...points, points[points.length - 1]];
  let d = '';
  const tension = 6; // standard Catmull-Rom -> Bezier factor
  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2];
    const c1x = p1.x + (p2.x - p0.x) / tension;
    const c1y = p1.y + (p2.y - p0.y) / tension;
    const c2x = p2.x - (p3.x - p1.x) / tension;
    const c2y = p2.y - (p3.y - p1.y) / tension;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

const AMP_RATIO = 0.28; // tab/blank bulge size, relative to edge length

// Key (s, n) control frames describing one tab/blank bump shape.
// s = fraction along the edge (0..1), n = fraction of amplitude,
// signed relative to the "outward" direction of the edge.
const BUMP_KEYFRAMES: { s: number; n: number }[] = [
  { s: 0.0, n: 0 },
  { s: 0.3, n: 0 },
  { s: 0.36, n: -0.12 }, // slight pinch inward -> gives the tab a "neck"
  { s: 0.4, n: 0.55 },
  { s: 0.44, n: 1.0 },
  { s: 0.5, n: 1.14 }, // bulb overshoot -> head wider than the neck
  { s: 0.56, n: 1.0 },
  { s: 0.6, n: 0.55 },
  { s: 0.64, n: -0.12 },
  { s: 0.7, n: 0 },
  { s: 1.0, n: 0 },
];

function edgePoints(start: Pt, uX: number, uY: number, outX: number, outY: number, length: number, type: EdgeType): Pt[] {
  if (type === 0) {
    return [start, { x: start.x + uX * length, y: start.y + uY * length }];
  }
  const amp = length * AMP_RATIO * type;
  return BUMP_KEYFRAMES.map(({ s, n }) => ({
    x: start.x + uX * (s * length) + outX * (n * amp),
    y: start.y + uY * (s * length) + outY * (n * amp),
  }));
}

/**
 * Builds an SVG path "d" string for one piece.
 * w, h: the piece's true (un-bulged) width/height.
 * marginX, marginY: extra canvas space around the piece to fit tabs/blanks.
 * edges: tab(1) / blank(-1) / flat(0) for each side.
 * Returns a path within a canvas of size (w + 2*marginX) x (h + 2*marginY),
 * with the piece's flat rectangle occupying (marginX, marginY) to
 * (marginX + w, marginY + h).
 */
export function piecePathD(w: number, h: number, marginX: number, marginY: number, edges: PieceEdges): string {
  const x0 = marginX;
  const y0 = marginY;
  const topLeft: Pt = { x: x0, y: y0 };
  const topRight: Pt = { x: x0 + w, y: y0 };
  const bottomRight: Pt = { x: x0 + w, y: y0 + h };
  const bottomLeft: Pt = { x: x0, y: y0 + h };

  // Each edge: start point, unit direction (u), outward unit normal (out), length, type.
  const top = edgePoints(topLeft, 1, 0, 0, -1, w, edges.top);
  const right = edgePoints(topRight, 0, 1, 1, 0, h, edges.right);
  const bottom = edgePoints(bottomRight, -1, 0, 0, 1, w, edges.bottom);
  const left = edgePoints(bottomLeft, 0, -1, -1, 0, h, edges.left);

  let d = `M ${topLeft.x.toFixed(2)} ${topLeft.y.toFixed(2)}`;
  for (const seg of [top, right, bottom, left]) {
    if (seg.length === 2) {
      d += ` L ${seg[1].x.toFixed(2)} ${seg[1].y.toFixed(2)}`;
    } else {
      d += catmullRomToBezierCommands(seg);
    }
  }
  d += ' Z';
  return d;
}
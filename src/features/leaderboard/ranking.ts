import type { ApiActivityType, ApiLeaderboardBoard, ApiRankedStudent } from '@/shared/api';

/**
 * The two leaderboards (items 6–8 of Adjustment 3). Quiz activities are ranked
 * by points and jigsaw activities by time, and the two are never mixed — so
 * each board asks the API for one activity type and names its ranking.
 *
 * The order itself is the server's (juanwise-be `rankLeaderboard`); the screen
 * shows the rows and ranks it is given and never re-sorts them.
 */
export interface BoardMeta {
  board: ApiLeaderboardBoard;
  activityType: ApiActivityType;
  label: string;
  icon: string;
  /** The one-line "How ranking works" note shown with the board. */
  note: string;
}

export const BOARDS: BoardMeta[] = [
  {
    board: 'points',
    activityType: 'quiz',
    label: 'Quiz · Points',
    icon: '❓',
    note:
      'Ranked by points, then less total time, then fewer failed or timed-out attempts. ' +
      'Players tied on all three share a rank.',
  },
  {
    board: 'time',
    activityType: 'jigsaw',
    label: 'Jigsaw · Time',
    icon: '🧩',
    note:
      'Ranked by average time per completed puzzle, then more points, then fewer failed or ' +
      'timed-out attempts. Players tied on all three share a rank.',
  },
];

export const boardMeta = (board: ApiLeaderboardBoard): BoardMeta =>
  BOARDS.find((meta) => meta.board === board) ?? BOARDS[0];

/** True when a neighbouring row carries the same rank, i.e. the server ranked them as tied. */
export function isTied(rows: Pick<ApiRankedStudent, 'rank'>[], index: number): boolean {
  const rank = rows[index]?.rank;
  return rows[index - 1]?.rank === rank || rows[index + 1]?.rank === rank;
}

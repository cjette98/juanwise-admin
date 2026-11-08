import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ApiGuestLeaderboard, ApiRankedStudent } from '@/shared/api';

const guestLeaderboard = vi.fn();
const leaderboard = vi.fn();

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  analyticsApi: {
    guestLeaderboard: (...args: unknown[]) => guestLeaderboard(...args),
    leaderboard: (...args: unknown[]) => leaderboard(...args),
  },
}));

vi.mock('@/features/directory/use-directory', () => ({
  useDirectory: () => ({ loading: true, error: null, teachers: [], classesByTeacher: new Map() }),
}));

const { default: LeaderboardScreen } = await import('./leaderboard-screen');

const row = (over: Partial<ApiRankedStudent>): ApiRankedStudent => ({
  uid: 'u',
  studentName: 'Student',
  totalPoints: 0,
  totalTimeSec: 0,
  activitiesCompleted: 0,
  failedAttempts: 0,
  avgTimeSec: null,
  goldMedals: 0,
  silverMedals: 0,
  bronzeMedals: 0,
  trophy: 'none',
  pace: 'none',
  completionPct: 0,
  rank: 1,
  ...over,
});

const response = (over: Partial<ApiGuestLeaderboard>): ApiGuestLeaderboard => ({
  board: 'points',
  items: [],
  maxPoints: 900,
  maxTimeSec: 3600,
  ...over,
});

const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('leaderboard boards', () => {
  it('opens on the Quiz points board and shows the server ranks as given', async () => {
    guestLeaderboard.mockResolvedValue(
      response({
        board: 'points',
        items: [
          // Server order, with a shared rank — not alphabetical, not renumbered.
          row({ uid: 'z', studentName: 'Zed', rank: 1, totalPoints: 90, totalTimeSec: 100, failedAttempts: 2 }),
          row({ uid: 'a', studentName: 'Ana', rank: 1, totalPoints: 90, totalTimeSec: 100, failedAttempts: 2 }),
          row({ uid: 'm', studentName: 'Mia', rank: 3, totalPoints: 75, totalTimeSec: 80, failedAttempts: 0 }),
        ],
      }),
    );

    render(<LeaderboardScreen />);
    await screen.findByText('Zed');

    expect(guestLeaderboard).toHaveBeenCalledWith(
      { category: undefined, activityType: 'quiz' },
      50,
      'points',
    );

    const headers = within(screen.getByRole('table'))
      .getAllByRole('columnheader')
      .map((th) => th.textContent);
    expect(headers).toEqual(['Rank', 'Name', 'Points', 'Total time', 'Failed attempts']);

    const rows = bodyRows();
    expect(rows.map((r) => within(r).getAllByRole('cell')[1].textContent)).toEqual(['Zed', 'Ana', 'Mia']);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual([
      '1tied',
      '1tied',
      '3',
    ]);
    expect(within(rows[0]).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      '1tied',
      'Zed',
      '90',
      '01:40',
      '2',
    ]);

    expect(
      screen.getByText(
        'Ranked by points, then less total time, then fewer failed or timed-out attempts. Players tied on all three share a rank.',
      ),
    ).toBeInTheDocument();
  });

  it('switches to the Jigsaw time board with its own columns and note', async () => {
    guestLeaderboard.mockImplementation((_filter, _limit, board) =>
      Promise.resolve(
        board === 'time'
          ? response({
              board: 'time',
              items: [
                row({ uid: 'c', studentName: 'Cara', rank: 1, avgTimeSec: 10, totalPoints: 90, failedAttempts: 1 }),
                row({ uid: 'b', studentName: 'Ben', rank: 2, avgTimeSec: 20.25, totalPoints: 180, failedAttempts: 0 }),
              ],
            })
          : response({ items: [row({ uid: 'x', studentName: 'Quiz Kid' })] }),
      ),
    );
    const user = userEvent.setup();

    render(<LeaderboardScreen />);
    await screen.findByText('Quiz Kid');

    await user.click(screen.getByRole('tab', { name: /Jigsaw · Time/ }));
    await screen.findByText('Cara');

    expect(guestLeaderboard).toHaveBeenLastCalledWith(
      { category: undefined, activityType: 'jigsaw' },
      50,
      'time',
    );
    expect(screen.getByRole('tab', { name: /Jigsaw · Time/ })).toHaveAttribute('aria-selected', 'true');

    const headers = within(screen.getByRole('table'))
      .getAllByRole('columnheader')
      .map((th) => th.textContent);
    expect(headers).toEqual(['Rank', 'Name', 'Avg time', 'Points', 'Failed attempts']);
    expect(within(bodyRows()[1]).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      '2',
      'Ben',
      '20.3 s',
      '180',
      '0',
    ]);
    expect(
      screen.getByText(
        'Ranked by average time per completed puzzle, then more points, then fewer failed or timed-out attempts. Players tied on all three share a rank.',
      ),
    ).toBeInTheDocument();
  });

  it('still shows an old API response, with dashes for the fields it does not send', async () => {
    const legacy = row({ uid: 'o', studentName: 'Old Row', rank: 1, totalPoints: 40 });
    delete legacy.failedAttempts;
    delete legacy.avgTimeSec;
    guestLeaderboard.mockResolvedValue({ items: [legacy], maxPoints: 900, maxTimeSec: 3600 });

    render(<LeaderboardScreen />);
    await screen.findByText('Old Row');

    expect(within(bodyRows()[0]).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      '1',
      'Old Row',
      '40',
      '00:00',
      '—',
    ]);
    expect(screen.getByText(/has not been updated to the new ranking/)).toBeInTheDocument();
  });

  it('passes the category filter along with the board', async () => {
    guestLeaderboard.mockResolvedValue(response({}));
    const user = userEvent.setup();

    render(<LeaderboardScreen />);
    await screen.findByText('No guest has finished an activity yet');
    await user.selectOptions(screen.getByLabelText('Category'), 'history');

    await waitFor(() =>
      expect(guestLeaderboard).toHaveBeenLastCalledWith(
        { category: 'history', activityType: 'quiz' },
        50,
        'points',
      ),
    );
  });
});

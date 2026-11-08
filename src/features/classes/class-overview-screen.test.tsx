import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type {
  ApiClass,
  ApiClassMember,
  ApiLeaderboard,
  ApiRankedStudent,
  ApiStudentProgression,
} from '@/shared/api';

const get = vi.fn();
const allMembers = vi.fn();
const removeMember = vi.fn();
const leaderboard = vi.fn();
const progression = vi.fn();

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  classesApi: {
    get: (...args: unknown[]) => get(...args),
    allMembers: (...args: unknown[]) => allMembers(...args),
    removeMember: (...args: unknown[]) => removeMember(...args),
  },
  analyticsApi: {
    leaderboard: (...args: unknown[]) => leaderboard(...args),
    progression: (...args: unknown[]) => progression(...args),
  },
}));

const { default: ClassOverviewScreen } = await import('./class-overview-screen');

const klass: ApiClass = {
  id: 'class-1',
  code: 'ABCDE12345',
  name: 'Grade 6 - Mabini',
  teacherId: 'teacher-1',
  gradeLevel: '6',
  section: 'Mabini',
  assignment: null,
  packId: null,
  packBinding: null,
  packVersion: null,
  memberCount: 3,
  archived: false,
  createdAt: null,
  updatedAt: null,
};

const member = (uid: string, name: string): ApiClassMember => ({
  uid,
  name,
  username: name.toLowerCase(),
  email: '',
  grade: '6',
  section: 'Mabini',
  lrn: null,
  status: 'active',
  joinedAt: null,
});

const ranked = (over: Partial<ApiRankedStudent>): ApiRankedStudent => ({
  uid: 'u',
  studentName: 'S',
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

const progress = (uid: string, done: number): ApiStudentProgression => ({
  uid,
  studentName: uid,
  activitiesCompleted: done,
  totalActivities: 30,
  levelsCompleted: Math.floor(done / 6),
  currentLevel: 1,
  totalPoints: 0,
  totalTimeSec: 0,
  percent: Math.round((done / 30) * 100),
  trophy: 'none',
  pace: 'none',
});

const board = (items: ApiRankedStudent[], name: 'points' | 'time' = 'points'): ApiLeaderboard => ({
  classId: 'class-1',
  board: name,
  items,
  maxPoints: 450,
  maxTimeSec: 1800,
});

function renderOverview() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/my-classes/class-1']}>
      <Routes>
        <Route path="/my-classes/:classId" element={<ClassOverviewScreen />} />
      </Routes>
    </MemoryRouter>,
  );
  return { user };
}

const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => c.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue(klass);
  allMembers.mockResolvedValue([member('ana', 'Ana'), member('ben', 'Ben'), member('cara', 'Cara')]);
  progression.mockResolvedValue({
    classId: 'class-1',
    items: [progress('ben', 12), progress('ana', 6), progress('cara', 0)],
  });
  leaderboard.mockImplementation((_id, _filter, _limit, name) =>
    Promise.resolve(
      name === 'time'
        ? board([ranked({ uid: 'ana', rank: 1, avgTimeSec: 12.5, totalPoints: 60, failedAttempts: 1 })], 'time')
        : board([
            // The server's order and ranks: Ben ahead of Ana; Cara has no results.
            ranked({ uid: 'ben', rank: 1, totalPoints: 150, totalTimeSec: 200, failedAttempts: 3 }),
            ranked({ uid: 'ana', rank: 2, totalPoints: 90, totalTimeSec: 95, failedAttempts: 0 }),
          ]),
    ),
  );
});

describe('class overview', () => {
  it("shows the roster in the leaderboard's order with the leaderboard's numbers", async () => {
    renderOverview();
    await screen.findByRole('table');

    expect(screen.getByRole('heading', { name: 'Grade 6 - Mabini' })).toBeInTheDocument();
    expect(leaderboard).toHaveBeenCalledWith('class-1', { activityType: 'quiz' }, 100, 'points');
    expect(progression).toHaveBeenCalledWith('class-1', { activityType: 'quiz' });

    const rows = bodyRows();
    expect(rows).toHaveLength(3);
    expect(cells(rows[0])).toEqual(['1', 'Ben@ben', '12/30 · 2 levels done', '150', '03:20', '3', 'Remove']);
    expect(cells(rows[1])).toEqual(['2', 'Ana@ana', '6/30 · 1 level done', '90', '01:35', '0', 'Remove']);
    // Nothing finished yet: no rank, zeros, and last.
    expect(cells(rows[2])).toEqual(['—', 'Cara@cara', '0/30 · 0 levels done', '0', '00:00', '0', 'Remove']);
  });

  it('switches to the jigsaw time board', async () => {
    const { user } = renderOverview();
    await screen.findByRole('table');

    await user.click(screen.getByRole('tab', { name: /Jigsaw · Time/ }));

    await waitFor(() =>
      expect(leaderboard).toHaveBeenLastCalledWith('class-1', { activityType: 'jigsaw' }, 100, 'time'),
    );
    await waitFor(() => expect(cells(bodyRows()[0])[3]).toBe('12.5 s'));
    expect(cells(bodyRows()[0]).slice(0, 2)).toEqual(['1', 'Ana@ana']);
  });

  it('removes a student after confirming', async () => {
    removeMember.mockResolvedValue(undefined);
    const { user } = renderOverview();
    await screen.findByRole('table');

    await user.click(within(bodyRows()[2]).getByRole('button', { name: 'Remove' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('open');
    expect(removeMember).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Yes, remove' }));

    await waitFor(() => expect(removeMember).toHaveBeenCalledWith('class-1', 'cara'));
    expect(await screen.findByText('Cara was removed from the class.')).toBeInTheDocument();
    expect(allMembers).toHaveBeenCalledTimes(2);
  });

  it('shows the class code when nobody has joined', async () => {
    allMembers.mockResolvedValue([]);
    progression.mockResolvedValue({ classId: 'class-1', items: [] });
    leaderboard.mockResolvedValue(board([]));
    renderOverview();

    expect(await screen.findByText('Nobody has joined this class yet')).toBeInTheDocument();
    expect(screen.getAllByText('ABCDE12345').length).toBeGreaterThan(0);
  });
});

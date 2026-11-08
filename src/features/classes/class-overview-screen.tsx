import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  analyticsApi,
  classesApi,
  errorMessage,
  type ApiClassMember,
  type ApiLeaderboardBoard,
  type ApiRankedStudent,
  type ApiStudentProgression,
} from '@/shared/api';
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Empty,
  Loading,
  Rank,
  Stat,
} from '@/shared/components/ui';
import { formatAverageTime, formatDuration, gradeSection } from '@/shared/lib/format';
import { useAsync } from '@/shared/lib/use-async';
import { RankingNote } from '@/features/leaderboard/leaderboard-screen';
import { BOARDS, boardMeta, isTied } from '@/features/leaderboard/ranking';

/** The API's ceiling on one leaderboard page; a class is smaller than this. */
const LEADERBOARD_LIMIT = 100;

interface OverviewRow {
  member: ApiClassMember;
  /** The student's leaderboard row — absent until they finish an activity. */
  ranked: ApiRankedStudent | null;
  progress: ApiStudentProgression | null;
}

/**
 * A teacher's view of one class (item 4 of Adjustment 3): the roster, how far
 * each student has got, and their points, time and failed attempts.
 *
 * The numbers are the leaderboard's own (item 1): points, time, failed
 * attempts and rank come from `GET /analytics/leaderboard` for the same board
 * and activity type, so a student's row here and on the leaderboard can never
 * disagree. Progress (activities done, levels finished) comes from
 * `GET /analytics/progression`, which counts the same passed activities.
 *
 * Rows follow the leaderboard's order; students who have not finished an
 * activity yet have no rank and come last, by name.
 */
export default function ClassOverviewScreen() {
  const { classId = '' } = useParams();
  const [board, setBoard] = useState<ApiLeaderboardBoard>('points');
  const meta = boardMeta(board);

  const klass = useAsync(() => classesApi.get(classId), [classId]);
  const roster = useAsync(() => classesApi.allMembers(classId), [classId]);
  const results = useAsync(
    () =>
      Promise.all([
        analyticsApi.leaderboard(
          classId,
          { activityType: meta.activityType },
          LEADERBOARD_LIMIT,
          board,
        ),
        analyticsApi.progression(classId, { activityType: meta.activityType }),
      ]).then(([leaderboard, progression]) => ({ leaderboard, progression })),
    [classId, board],
  );

  const [pendingRemoval, setPendingRemoval] = useState<ApiClassMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = useMemo<OverviewRow[]>(() => {
    const members = (roster.data ?? []).filter((m) => m.status === 'active');
    const byUid = new Map(members.map((m) => [m.uid, m]));
    const progressByUid = new Map(
      (results.data?.progression.items ?? []).map((p) => [p.uid, p]),
    );

    const ranked: OverviewRow[] = [];
    const seen = new Set<string>();
    // The leaderboard's order, untouched. A former student who still owns
    // results is on the leaderboard but not on the roster, so is left out.
    for (const row of results.data?.leaderboard.items ?? []) {
      const member = byUid.get(row.uid);
      if (!member) continue;
      seen.add(row.uid);
      ranked.push({ member, ranked: row, progress: progressByUid.get(row.uid) ?? null });
    }

    const unranked = members
      .filter((m) => !seen.has(m.uid))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((member) => ({ member, ranked: null, progress: progressByUid.get(member.uid) ?? null }));

    return [...ranked, ...unranked];
  }, [roster.data, results.data]);

  // Ties are read off the whole leaderboard, which may also hold a former student.
  const leaderboardRows = results.data?.leaderboard.items ?? [];
  const started = rows.filter((row) => row.ranked !== null).length;
  const averagePercent =
    rows.length === 0
      ? 0
      : Math.round(rows.reduce((sum, row) => sum + (row.progress?.percent ?? 0), 0) / rows.length);
  const legacyApi = results.data !== null && !results.data.leaderboard.board;

  const removeStudent = async () => {
    if (!pendingRemoval) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await classesApi.removeMember(classId, pendingRemoval.uid);
      setNotice(`${pendingRemoval.name} was removed from the class.`);
      setPendingRemoval(null);
      roster.reload();
      results.reload();
      klass.reload();
    } catch (err) {
      setRemoveError(errorMessage(err, 'The student could not be removed.'));
    } finally {
      setRemoving(false);
    }
  };

  const reloadAll = () => {
    klass.reload();
    roster.reload();
    results.reload();
  };

  if (klass.loading && !klass.data) return <Loading label="Loading the class…" />;
  if (klass.error || !klass.data) {
    return (
      <>
        <Banner tone="error">{klass.error ?? 'That class could not be found.'}</Banner>
        <div className="row">
          <Button onClick={klass.reload}>Try again</Button>
          <Link to="/my-classes">
            <Button variant="secondary">Back to My Classes</Button>
          </Link>
        </div>
      </>
    );
  }

  const current = klass.data;
  const loadingRows = roster.loading || results.loading;
  const rowsError = roster.error ?? results.error;

  return (
    <>
      <div className="row">
        <Link to="/my-classes">← My Classes</Link>
      </div>

      <Card
        title={current.name}
        hint={gradeSection(current.gradeLevel, current.section)}
        actions={
          <>
            <Badge tone="code">{current.code}</Badge>
            <Button variant="secondary" small onClick={reloadAll}>
              Refresh
            </Button>
          </>
        }
      >
        <div className="grid grid--stats">
          <Stat label="Students" value={rows.length || current.memberCount} />
          <Stat
            label="Started"
            value={loadingRows ? '…' : started}
            hint={`finished at least one ${meta.activityType}`}
          />
          <Stat
            label="Average progress"
            value={loadingRows ? '…' : `${averagePercent}%`}
            hint={`of every ${meta.activityType} activity`}
          />
        </div>
      </Card>

      <div className="pill-tabs" role="tablist" aria-label="Board" style={{ justifySelf: 'start' }}>
        {BOARDS.map((item) => (
          <button
            key={item.board}
            role="tab"
            aria-selected={board === item.board}
            className={`pill-tab ${board === item.board ? 'pill-tab--active' : ''}`}
            onClick={() => setBoard(item.board)}
          >
            <span aria-hidden>{item.icon}</span> {item.label}
          </button>
        ))}
      </div>

      <Card
        title={`Roster and results · ${meta.label}`}
        hint="The same numbers each student sees on the class leaderboard"
        bodyless
      >
        <RankingNote board={board} />

        {notice && (
          <div className="card__body" style={{ paddingBottom: 0 }}>
            <Banner tone="success">{notice}</Banner>
          </div>
        )}
        {legacyApi && (
          <div className="card__body" style={{ paddingBottom: 0 }}>
            <Banner tone="info">
              The server has not been updated to the new ranking yet, so ranks follow points and
              failed attempts are blank.
            </Banner>
          </div>
        )}

        {loadingRows ? (
          <Loading label="Loading the roster and results…" />
        ) : rowsError ? (
          <div className="card__body">
            <Banner tone="error">{rowsError}</Banner>
          </div>
        ) : rows.length === 0 ? (
          <Empty
            icon="🎒"
            title="Nobody has joined this class yet"
            hint={
              <>
                Students join in the JuanWise app with the code{' '}
                <Badge tone="code">{current.code}</Badge>.
              </>
            }
          />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th style={{ width: 88 }}>Rank</th>
                <th>Student</th>
                <th>Progress</th>
                {board === 'time' ? (
                  <>
                    <th className="table__num">Avg time</th>
                    <th className="table__num">Points</th>
                  </>
                ) : (
                  <>
                    <th className="table__num">Points</th>
                    <th className="table__num">Total time</th>
                  </>
                )}
                <th className="table__num">Failed attempts</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, ranked, progress }) => {
                const rankIndex = ranked ? leaderboardRows.indexOf(ranked) : -1;
                return (
                  <tr key={member.uid}>
                    <td>
                      {ranked ? (
                        <Rank rank={ranked.rank} tied={isTied(leaderboardRows, rankIndex)} />
                      ) : (
                        <span className="table__sub">—</span>
                      )}
                    </td>
                    <td>
                      <div className="table__primary">{member.name || '(unnamed)'}</div>
                      <div className="table__sub">@{member.username}</div>
                    </td>
                    <td>
                      <ProgressCell progress={progress} />
                    </td>
                    {board === 'time' ? (
                      <>
                        <td className="table__num">
                          <strong>{formatAverageTime(ranked?.avgTimeSec)}</strong>
                        </td>
                        <td className="table__num">{ranked?.totalPoints ?? 0}</td>
                      </>
                    ) : (
                      <>
                        <td className="table__num">
                          <strong>{ranked?.totalPoints ?? 0}</strong>
                        </td>
                        <td className="table__num">{formatDuration(ranked?.totalTimeSec ?? 0)}</td>
                      </>
                    )}
                    <td className="table__num">
                      {ranked === null
                        ? 0
                        : ranked.failedAttempts ?? <span className="table__sub">—</span>}
                    </td>
                    <td>
                      <div className="row row--tight">
                        <Button
                          variant="danger"
                          small
                          onClick={() => {
                            setRemoveError(null);
                            setNotice(null);
                            setPendingRemoval(member);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </Card>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={`Remove ${pendingRemoval?.name ?? 'this student'} from ${current.name}?`}
        confirmLabel="Yes, remove"
        cancelLabel="Keep in class"
        danger
        busy={removing}
        onConfirm={removeStudent}
        onCancel={() => {
          setPendingRemoval(null);
          setRemoveError(null);
        }}
      >
        <p>
          They leave the roster and stop seeing this class's activities. The results they already
          earned stay recorded under their name.
        </p>
        {removeError && <Banner tone="error">{removeError}</Banner>}
      </ConfirmDialog>
    </>
  );
}

function ProgressCell({ progress }: { progress: ApiStudentProgression | null }) {
  if (!progress) return <span className="table__sub">Not started</span>;
  return (
    <div className="progress-cell">
      <div className="progress-cell__text">
        <strong>
          {progress.activitiesCompleted}/{progress.totalActivities}
        </strong>{' '}
        <span className="table__sub">
          · {progress.levelsCompleted} level{progress.levelsCompleted === 1 ? '' : 's'} done
        </span>
      </div>
      <div
        className="progress-bar"
        role="progressbar"
        aria-label="Activities completed"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
      >
        <span style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  );
}

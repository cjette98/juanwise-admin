import { useMemo, useState } from 'react';
import {
  analyticsApi,
  type AnalyticsFilter,
  type ApiCategoryKey,
  type ApiClass,
  type ApiLeaderboardBoard,
  type ApiRankedStudent,
} from '@/shared/api';
import { Badge, Banner, Button, Card, DataTable, Empty, Loading, Rank, Select } from '@/shared/components/ui';
import { formatAverageTime, formatDuration } from '@/shared/lib/format';
import { categoryMeta } from '@/shared/theme/colors';
import { useAsync } from '@/shared/lib/use-async';
import { useDirectory } from '@/features/directory/use-directory';
import { BOARDS, boardMeta, isTied } from './ranking';

type Players = 'guest' | 'classes';

const TOP_N = 10;

/**
 * Two kinds of player, and two boards for each.
 *
 * A guest is registered but joined no class, so there is no roster to rank them
 * against — they are ranked against each other, deployment-wide, by
 * `GET /analytics/leaderboard/guests`. A student in a class is ranked inside
 * that class, so the second view walks teacher → class → top ten and never
 * mixes two classes into one ranking.
 *
 * Quiz and jigsaw are ranked separately (items 6–8 of Adjustment 3): the Quiz
 * board by points, the Jigsaw board by average time. Each passes `board` and
 * its activity type, and shows the server's rows and ranks exactly as given.
 */
export default function LeaderboardScreen() {
  const [players, setPlayers] = useState<Players>('guest');
  const [board, setBoard] = useState<ApiLeaderboardBoard>('points');
  const [category, setCategory] = useState<ApiCategoryKey | ''>('');

  const meta = boardMeta(board);
  const filter = useMemo<AnalyticsFilter>(
    () => ({ category: category || undefined, activityType: meta.activityType }),
    [category, meta.activityType],
  );

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <div className="pill-tabs" role="tablist" aria-label="Players">
            <button
              role="tab"
              aria-selected={players === 'guest'}
              className={`pill-tab ${players === 'guest' ? 'pill-tab--active' : ''}`}
              onClick={() => setPlayers('guest')}
            >
              👤 Guests
            </button>
            <button
              role="tab"
              aria-selected={players === 'classes'}
              className={`pill-tab ${players === 'classes' ? 'pill-tab--active' : ''}`}
              onClick={() => setPlayers('classes')}
            >
              🏫 Assigned classes
            </button>
          </div>

          <div className="pill-tabs" role="tablist" aria-label="Board">
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
        </div>

        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value as ApiCategoryKey | '')}
          style={{ width: 200 }}
          aria-label="Category"
        >
          <option value="">All categories</option>
          {categoryMeta.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>

      {players === 'guest' ? (
        <GuestBoard filter={filter} board={board} />
      ) : (
        <ClassBoards filter={filter} board={board} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------- guests */

function GuestBoard({ filter, board }: { filter: AnalyticsFilter; board: ApiLeaderboardBoard }) {
  const state = useAsync(
    () => analyticsApi.guestLeaderboard(filter, 50, board),
    [filter.category, filter.activityType, board],
  );

  return (
    <Card
      title={`Guest leaderboard · ${boardMeta(board).label}`}
      hint="Registered players who have not joined a class, ranked against each other"
      actions={
        <Button variant="secondary" small onClick={state.reload}>
          Refresh
        </Button>
      }
      bodyless
    >
      <RankingNote board={board} />
      {state.loading ? (
        <Loading label="Ranking guests…" />
      ) : state.error ? (
        <div className="card__body">
          <Banner tone="error">{state.error}</Banner>
        </div>
      ) : !state.data || state.data.items.length === 0 ? (
        <Empty
          icon="👤"
          title="No guest has finished an activity yet"
          hint={`A guest appears here once they complete their first ${filter.activityType ?? 'activity'}.`}
        />
      ) : (
        <>
          {!state.data.board && <LegacyNotice />}
          <RankTable rows={state.data.items} board={board} />
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ classes */

function ClassBoards({ filter, board }: { filter: AnalyticsFilter; board: ApiLeaderboardBoard }) {
  const directory = useDirectory();

  if (directory.loading) return <Loading label="Loading teachers and classes…" />;
  if (directory.error) {
    return (
      <>
        <Banner tone="error">{directory.error}</Banner>
        <div>
          <Button onClick={directory.reload}>Try again</Button>
        </div>
      </>
    );
  }

  const teachersWithClasses = directory.teachers
    .map((teacher) => ({ teacher, classes: directory.classesByTeacher.get(teacher.uid) ?? [] }))
    .sort((a, b) => a.teacher.name.localeCompare(b.teacher.name));

  if (teachersWithClasses.length === 0) {
    return (
      <Card>
        <Empty icon="🧑‍🏫" title="No teachers registered yet" />
      </Card>
    );
  }

  return (
    <>
      <Card bodyless>
        <RankingNote board={board} />
      </Card>
      {teachersWithClasses.map(({ teacher, classes }) => (
        <Card
          key={teacher.uid}
          title={teacher.name}
          hint={
            classes.length === 0
              ? 'No classes yet'
              : `${classes.length} class${classes.length === 1 ? '' : 'es'} · top ${TOP_N} shown per class`
          }
        >
          {classes.length === 0 ? (
            <div className="table__sub">
              This teacher has not created a class, so there is nothing to rank yet.
            </div>
          ) : (
            <div className="grid">
              {classes.map((klass) => (
                <ClassBoard key={klass.id} klass={klass} filter={filter} board={board} />
              ))}
            </div>
          )}
        </Card>
      ))}
    </>
  );
}

function ClassBoard({
  klass,
  filter,
  board,
}: {
  klass: ApiClass;
  filter: AnalyticsFilter;
  board: ApiLeaderboardBoard;
}) {
  const state = useAsync(
    () => analyticsApi.leaderboard(klass.id, filter, TOP_N, board),
    [klass.id, filter.category, filter.activityType, board],
  );

  return (
    <div className="card" style={{ boxShadow: 'none' }}>
      <div className="card__header">
        <div className="card__header-text">
          <h3>{klass.name}</h3>
          <div className="card__hint">
            {[klass.gradeLevel ? `Grade ${klass.gradeLevel}` : null, klass.section]
              .filter(Boolean)
              .join(' · ') || 'No grade or section set'}
          </div>
        </div>
        <div className="card__actions">
          <Badge tone="code">{klass.code}</Badge>
          <Badge>{klass.memberCount} joined</Badge>
        </div>
      </div>

      {state.loading ? (
        <Loading label="Ranking…" />
      ) : state.error ? (
        <div className="card__body">
          <Banner tone="error">{state.error}</Banner>
        </div>
      ) : !state.data || state.data.items.length === 0 ? (
        <Empty
          icon="🎯"
          title="Nobody in this class has finished an activity yet"
          hint="Rankings appear as soon as a student submits their first result."
        />
      ) : (
        <>
          {!state.data.board && <LegacyNotice />}
          <RankTable rows={state.data.items} board={board} />
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- table */

export function RankingNote({ board }: { board: ApiLeaderboardBoard }) {
  return (
    <div className="ranking-note" role="note">
      <strong>How ranking works:</strong>
      <span>{boardMeta(board).note}</span>
    </div>
  );
}

/**
 * The API this console talks to may still be the one from before the ranking
 * change (juanwise-be PR #11): it sends no `board`, no failed attempts and no
 * average time, and ranks every board by points. The rows still show, with a
 * dash where a number is missing.
 */
function LegacyNotice() {
  return (
    <div className="card__body" style={{ paddingBottom: 0 }}>
      <Banner tone="info">
        The server has not been updated to the new ranking yet, so this board is ordered by
        points and the failed-attempt and average-time columns are blank.
      </Banner>
    </div>
  );
}

const dash = <span className="table__sub">—</span>;

function failed(row: ApiRankedStudent) {
  return row.failedAttempts === undefined ? dash : row.failedAttempts;
}

/**
 * The rows in the order the server sent them, with the server's rank. The
 * board's main measure comes first after the name.
 */
export function RankTable({ rows, board }: { rows: ApiRankedStudent[]; board: ApiLeaderboardBoard }) {
  return (
    <DataTable>
      <thead>
        {board === 'time' ? (
          <tr>
            <th style={{ width: 88 }}>Rank</th>
            <th>Name</th>
            <th className="table__num">Avg time</th>
            <th className="table__num">Points</th>
            <th className="table__num">Failed attempts</th>
          </tr>
        ) : (
          <tr>
            <th style={{ width: 88 }}>Rank</th>
            <th>Name</th>
            <th className="table__num">Points</th>
            <th className="table__num">Total time</th>
            <th className="table__num">Failed attempts</th>
          </tr>
        )}
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.uid}>
            <td>
              <Rank rank={row.rank} tied={isTied(rows, index)} />
            </td>
            <td className="table__primary">{row.studentName || '(unnamed)'}</td>
            {board === 'time' ? (
              <>
                <td className="table__num">
                  <strong>{row.avgTimeSec == null ? dash : formatAverageTime(row.avgTimeSec)}</strong>
                </td>
                <td className="table__num">{row.totalPoints}</td>
              </>
            ) : (
              <>
                <td className="table__num">
                  <strong>{row.totalPoints}</strong>
                </td>
                <td className="table__num">{formatDuration(row.totalTimeSec)}</td>
              </>
            )}
            <td className="table__num">{failed(row)}</td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

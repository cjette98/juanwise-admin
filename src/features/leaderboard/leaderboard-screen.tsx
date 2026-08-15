import { useMemo, useState } from 'react';
import {
  analyticsApi,
  type AnalyticsFilter,
  type ApiCategoryKey,
  type ApiClass,
  type ApiRankedStudent,
} from '@/shared/api';
import { Badge, Banner, Button, Card, Empty, Loading, Rank, Select } from '@/shared/components/ui';
import { formatDuration, TROPHY_ICON } from '@/shared/lib/format';
import { categoryMeta } from '@/shared/theme/colors';
import { useAsync } from '@/shared/lib/use-async';
import { useDirectory } from '@/features/directory/use-directory';

type Board = 'guest' | 'classes';

const TOP_N = 10;

/**
 * Two boards, because JuanWise has two kinds of player.
 *
 * A guest is registered but joined no class, so there is no roster to rank them
 * against — they are ranked against each other, deployment-wide, by
 * `GET /analytics/leaderboard/guests`. A student in a class is ranked inside
 * that class, so the second board walks teacher → class → top ten and never
 * mixes two classes into one ranking.
 */
export default function LeaderboardScreen() {
  const [board, setBoard] = useState<Board>('guest');
  const [category, setCategory] = useState<ApiCategoryKey | ''>('');
  const [activityType, setActivityType] = useState<'' | 'quiz' | 'jigsaw'>('');

  const filter = useMemo<AnalyticsFilter>(
    () => ({
      category: category || undefined,
      activityType: activityType || undefined,
    }),
    [category, activityType],
  );

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="pill-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={board === 'guest'}
            className={`pill-tab ${board === 'guest' ? 'pill-tab--active' : ''}`}
            onClick={() => setBoard('guest')}
          >
            👤 Guests
          </button>
          <button
            role="tab"
            aria-selected={board === 'classes'}
            className={`pill-tab ${board === 'classes' ? 'pill-tab--active' : ''}`}
            onClick={() => setBoard('classes')}
          >
            🏫 Assigned classes
          </button>
        </div>

        <div className="row">
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as ApiCategoryKey | '')}
            style={{ width: 200 }}
          >
            <option value="">All categories</option>
            {categoryMeta.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value as '' | 'quiz' | 'jigsaw')}
            style={{ width: 150 }}
          >
            <option value="">Quiz &amp; Jigsaw</option>
            <option value="quiz">Quiz only</option>
            <option value="jigsaw">Jigsaw only</option>
          </Select>
        </div>
      </div>

      {board === 'guest' ? <GuestBoard filter={filter} /> : <ClassBoards filter={filter} />}
    </>
  );
}

/* ------------------------------------------------------------------- guests */

function GuestBoard({ filter }: { filter: AnalyticsFilter }) {
  const state = useAsync(
    () => analyticsApi.guestLeaderboard(filter, 50),
    [filter.category, filter.activityType],
  );

  return (
    <Card
      title="Guest leaderboard"
      hint="Registered players who have not joined a class, ranked against each other"
      actions={
        <Button variant="secondary" small onClick={state.reload}>
          Refresh
        </Button>
      }
      bodyless
    >
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
          hint="A guest appears here once they complete their first quiz or jigsaw."
        />
      ) : (
        <RankTable rows={state.data.items} maxPoints={state.data.maxPoints} />
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ classes */

function ClassBoards({ filter }: { filter: AnalyticsFilter }) {
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
                <ClassBoard key={klass.id} klass={klass} filter={filter} />
              ))}
            </div>
          )}
        </Card>
      ))}
    </>
  );
}

function ClassBoard({ klass, filter }: { klass: ApiClass; filter: AnalyticsFilter }) {
  const state = useAsync(
    () => analyticsApi.leaderboard(klass.id, filter, TOP_N),
    [klass.id, filter.category, filter.activityType],
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
        <RankTable rows={state.data.items} maxPoints={state.data.maxPoints} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- table */

function RankTable({ rows, maxPoints }: { rows: ApiRankedStudent[]; maxPoints: number }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 56 }}>Rank</th>
            <th>Student</th>
            <th className="table__num">Points</th>
            <th className="table__num">Activities</th>
            <th className="table__num">Time</th>
            <th>Medals</th>
            <th>Trophy</th>
            <th className="table__num">Progress</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.uid}>
              <td>
                <Rank rank={row.rank} />
              </td>
              <td className="table__primary">{row.studentName || '(unnamed)'}</td>
              <td className="table__num">
                <strong>{row.totalPoints}</strong>
                <span className="table__sub"> / {maxPoints}</span>
              </td>
              <td className="table__num">{row.activitiesCompleted}</td>
              <td className="table__num">{formatDuration(row.totalTimeSec)}</td>
              <td className="table__sub">
                🥇 {row.goldMedals} · 🥈 {row.silverMedals} · 🥉 {row.bronzeMedals}
              </td>
              <td>
                {row.trophy === 'none' ? (
                  <span className="table__sub">—</span>
                ) : (
                  <Badge tone={row.trophy === 'gold' ? 'gold' : 'default'}>
                    {TROPHY_ICON[row.trophy]} {row.trophy}
                  </Badge>
                )}
              </td>
              <td className="table__num">{row.completionPct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

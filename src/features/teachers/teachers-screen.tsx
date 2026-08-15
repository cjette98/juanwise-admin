import { Fragment, useMemo, useState } from 'react';
import type { ApiClass } from '@/shared/api';
import { Badge, Banner, Button, Card, Empty, Input, Loading } from '@/shared/components/ui';
import { formatDate, matchesSearch } from '@/shared/lib/format';
import { categoryLabel } from '@/shared/theme/colors';
import { useDirectory } from '@/features/directory/use-directory';

/**
 * Every teacher, each row expanding into the classes they own.
 *
 * Classes hang off the teacher rather than getting their own page because a
 * class only means something in the context of who runs it — and the class code
 * an admin is usually hunting for is the one belonging to a named teacher.
 */
export default function TeachersScreen() {
  const directory = useDirectory();
  const { teachers, classesByTeacher, loading, error, reload } = directory;
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      teachers
        .filter((teacher) =>
          matchesSearch(search, teacher.name, teacher.username, teacher.email, teacher.teacherId),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [teachers, search],
  );

  if (loading) return <Loading label="Loading teachers…" />;
  if (error) {
    return (
      <>
        <Banner tone="error">{error}</Banner>
        <div>
          <Button onClick={reload}>Try again</Button>
        </div>
      </>
    );
  }

  return (
    <Card
      title={`Teachers (${rows.length}${rows.length !== teachers.length ? ` of ${teachers.length}` : ''})`}
      hint="Click a row to see that teacher's classes and class codes"
      actions={
        <>
          <Input
            placeholder="Search name, username, ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
          <Button variant="secondary" small onClick={reload}>
            Refresh
          </Button>
        </>
      }
      bodyless
    >
      {rows.length === 0 ? (
        <Empty
          icon="🧑‍🏫"
          title={teachers.length === 0 ? 'No teachers registered yet' : 'No teacher matches that search'}
          hint={
            teachers.length === 0
              ? 'A teacher appears here as soon as they register in the JuanWise app.'
              : 'Try a different name, username or teacher ID.'
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 32 }} />
                <th>Teacher</th>
                <th>Teacher ID</th>
                <th>Email</th>
                <th className="table__num">Classes</th>
                <th className="table__num">Students</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((teacher) => {
                const classes = classesByTeacher.get(teacher.uid) ?? [];
                const students = classes.reduce((sum, c) => sum + c.memberCount, 0);
                const isOpen = expanded === teacher.uid;

                return (
                  <Fragment key={teacher.uid}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : teacher.uid)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="table__sub" aria-hidden>
                        {isOpen ? '▾' : '▸'}
                      </td>
                      <td>
                        <div className="table__primary">{teacher.name}</div>
                        <div className="table__sub">@{teacher.username}</div>
                      </td>
                      <td>{teacher.teacherId ?? <span className="table__sub">—</span>}</td>
                      <td className="table__sub">{teacher.email}</td>
                      <td className="table__num">{classes.length}</td>
                      <td className="table__num">{students}</td>
                      <td className="table__sub">{formatDate(teacher.createdAt)}</td>
                    </tr>

                    {isOpen && (
                      <tr>
                        <td colSpan={7} style={{ background: 'var(--canvas)', padding: '12px 14px 16px 46px' }}>
                          <ClassList classes={classes} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ClassList({ classes }: { classes: ApiClass[] }) {
  if (classes.length === 0) {
    return <div className="table__sub">This teacher has not created a class yet.</div>;
  }

  return (
    <div className="grid grid--2">
      {classes.map((klass) => (
        <div className="card" key={klass.id} style={{ padding: '12px 14px' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>{klass.name}</strong>
            <Badge tone="code">{klass.code}</Badge>
          </div>
          <div className="table__sub" style={{ marginTop: 4 }}>
            {[
              klass.gradeLevel ? `Grade ${klass.gradeLevel}` : null,
              klass.section,
              `${klass.memberCount} student${klass.memberCount === 1 ? '' : 's'}`,
              `created ${formatDate(klass.createdAt)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            {klass.assignment ? (
              <Badge tone="blue">
                Assigned: {categoryLabel(klass.assignment.category)} ·{' '}
                {klass.assignment.gameType === 'quiz' ? 'Quiz' : 'Jigsaw'}
              </Badge>
            ) : (
              <Badge>No current assignment</Badge>
            )}
            {klass.archived && <Badge tone="red">Archived</Badge>}
          </div>
        </div>
      ))}
    </div>
  );
}

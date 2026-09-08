import { Link } from 'react-router-dom';
import { Badge, Banner, Button, Card, Empty, Loading, Stat } from '@/shared/components/ui';
import { formatDate } from '@/shared/lib/format';
import { useDirectory } from '@/features/directory/use-directory';

/** The landing page: the same four counts an admin opens the console to check. */
export default function DashboardScreen() {
  const directory = useDirectory();
  const { teachers, students, classes, guests, loading, error, reload } = directory;

  if (loading) return <Loading label="Loading the directory…" />;
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

  const assignedStudents = students.length - guests.length;
  const classesWithNoMembers = classes.filter((c) => c.memberCount === 0).length;
  const recentClasses = [...classes]
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, 6);

  return (
    <>
      <div className="grid grid--stats">
        <Stat label="Teachers" value={teachers.length} hint="Registered teacher accounts" />
        <Stat
          label="Students"
          value={students.length}
          hint={`${assignedStudents} in a class · ${guests.length} guest${guests.length === 1 ? '' : 's'}`}
        />
        <Stat
          label="Classes"
          value={classes.length}
          hint={
            classesWithNoMembers
              ? `${classesWithNoMembers} with nobody joined yet`
              : 'All classes have members'
          }
        />
        <Stat
          label="Guests"
          value={guests.length}
          hint="Registered, but not in any class"
        />
      </div>

      <Card
        title="Newest classes"
        hint="The most recently created classes across every teacher"
        actions={
          <Link to="/teachers">
            <Button variant="secondary" small>
              All teachers
            </Button>
          </Link>
        }
        bodyless
      >
        {recentClasses.length === 0 ? (
          <Empty
            icon="🏫"
            title="No classes yet"
            hint="A class appears here as soon as a teacher creates one in the JuanWise app."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Teacher</th>
                  <th>Code</th>
                  <th className="table__num">Students</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentClasses.map((klass) => {
                  const teacher = directory.teacherByUid.get(klass.teacherId);
                  return (
                    <tr key={klass.id}>
                      <td>
                        <div className="table__primary">{klass.name}</div>
                        <div className="table__sub">
                          {[klass.gradeLevel && `Grade ${klass.gradeLevel}`, klass.section]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </div>
                      </td>
                      <td>{teacher?.name ?? <span className="table__sub">Unknown teacher</span>}</td>
                      <td>
                        <Badge tone="code">{klass.code}</Badge>
                      </td>
                      <td className="table__num">{klass.memberCount}</td>
                      <td className="table__sub">{formatDate(klass.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Content shortcuts">
        <div className="row">
          <Link to="/packs/system-default/quiz">
            <Button variant="secondary">📝 Author quiz questions</Button>
          </Link>
          <Link to="/packs/system-default/jigsaw">
            <Button variant="secondary">🧩 Set jigsaw pictures</Button>
          </Link>
          <Link to="/leaderboard">
            <Button variant="secondary">🏆 View leaderboards</Button>
          </Link>
        </div>
      </Card>
    </>
  );
}

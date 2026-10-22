import { useState } from 'react';
import { Link } from 'react-router-dom';
import { classesApi, errorMessage, type ApiClass } from '@/shared/api';
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  Empty,
  Loading,
  Select,
  Stat,
} from '@/shared/components/ui';
import { formatDate, gradeSection, sectionNote } from '@/shared/lib/format';
import { useDirectory } from '@/features/directory/use-directory';

/**
 * The landing page: the same four counts an admin opens the console to check,
 * plus the Delete button for an inactive class (item W3.1 of the client
 * evaluation).
 */
export default function DashboardScreen() {
  const directory = useDirectory();
  const { teachers, students, classes, guests, loading, error, reload } = directory;
  const [pendingDelete, setPendingDelete] = useState<ApiClass | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [classView, setClassView] = useState<'newest' | 'empty'>('newest');

  const deleteClass = async () => {
    if (!pendingDelete) return;
    const klass = pendingDelete;
    setBusy(true);
    setActionError(null);
    try {
      await classesApi.remove(klass.id);
      setPendingDelete(null);
      setNotice(`${klass.name} was deleted and the code ${klass.code} is free again.`);
      reload();
    } catch (err) {
      // The API names what it found — a roster entry, a recorded result — and
      // that is the whole answer to "why can't I delete this?".
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

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
  const emptyClasses = classes.filter((c) => c.memberCount === 0);
  const newestFirst = [...classes].sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  );
  // Newest is the usual glance; the empty view exists so every class that can
  // be deleted is reachable, not only the six most recent.
  const shownClasses =
    classView === 'empty'
      ? newestFirst.filter((c) => c.memberCount === 0)
      : newestFirst.slice(0, 6);

  return (
    <>
      {notice && <Banner tone="success">{notice}</Banner>}

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
            emptyClasses.length
              ? `${emptyClasses.length} with nobody joined yet`
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
        title={classView === 'empty' ? 'Classes with nobody joined' : 'Newest classes'}
        hint={
          classView === 'empty'
            ? 'Every class no student has joined — these are the ones that can be deleted'
            : 'The most recently created classes across every teacher'
        }
        actions={
          <>
            <Select
              value={classView}
              onChange={(e) => setClassView(e.target.value as 'newest' | 'empty')}
              style={{ width: 200 }}
            >
              <option value="newest">Newest classes</option>
              <option value="empty">Nobody joined</option>
            </Select>
            <Link to="/teachers">
              <Button variant="secondary" small>
                All teachers
              </Button>
            </Link>
          </>
        }
        bodyless
      >
        {shownClasses.length === 0 ? (
          <Empty
            icon="🏫"
            title={classView === 'empty' ? 'Every class has students' : 'No classes yet'}
            hint={
              classView === 'empty'
                ? 'Nothing to clear out — a class with a roster is kept.'
                : 'A class appears here as soon as a teacher creates one in the JuanWise app.'
            }
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {shownClasses.map((klass) => {
                  const teacher = directory.teacherByUid.get(klass.teacherId);
                  return (
                    <tr key={klass.id}>
                      <td>
                        <div className="table__primary">{klass.name}</div>
                        <div className="table__sub" title={sectionNote(klass.section)}>
                          {gradeSection(klass.gradeLevel, klass.section)}
                        </div>
                      </td>
                      <td>{teacher?.name ?? <span className="table__sub">Unknown teacher</span>}</td>
                      <td>
                        <Badge tone="code">{klass.code}</Badge>
                      </td>
                      <td className="table__num">{klass.memberCount}</td>
                      <td className="table__sub">{formatDate(klass.createdAt)}</td>
                      <td>
                        {klass.memberCount === 0 && (
                          <Button
                            variant="danger"
                            small
                            onClick={() => {
                              setPendingDelete(klass);
                              setNotice(null);
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? 'this class'}?`}
        confirmLabel="Yes, delete the class"
        cancelLabel="Keep the class"
        danger
        busy={busy}
        onConfirm={deleteClass}
        onCancel={() => {
          setPendingDelete(null);
          setActionError(null);
        }}
      >
        <p>
          Nobody has joined it, so nothing is lost — the code {pendingDelete?.code} becomes
          available again. A class with a roster or recorded results cannot be deleted.
        </p>
        {actionError && <Banner tone="error">{actionError}</Banner>}
      </ConfirmDialog>

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

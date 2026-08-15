import { useMemo, useState } from 'react';
import { Badge, Banner, Button, Card, Empty, Input, Loading, Select } from '@/shared/components/ui';
import { formatDate, matchesSearch } from '@/shared/lib/format';
import { teacherForStudent, useDirectory } from '@/features/directory/use-directory';

type Filter = 'all' | 'assigned' | 'guest';

/**
 * Every student, with the two columns an admin actually comes here for: the
 * teacher who owns their class and the code they joined with.
 *
 * Both are derived rather than stored on the student — a profile only carries
 * `classId`, so the class supplies the code and the class's `teacherId`
 * supplies the teacher.
 */
export default function StudentsScreen() {
  const directory = useDirectory();
  const { students, classById, loading, error, reload } = directory;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(() => {
    return students
      .map((student) => {
        const klass = student.classId ? (classById.get(student.classId) ?? null) : null;
        const teacher = teacherForStudent(student, directory);
        return { student, klass, teacher };
      })
      .filter(({ student, klass, teacher }) => {
        if (filter === 'assigned' && !klass) return false;
        if (filter === 'guest' && klass) return false;
        return matchesSearch(
          search,
          student.name,
          student.username,
          student.email,
          student.lrn,
          klass?.code,
          klass?.name,
          teacher?.name,
        );
      })
      .sort((a, b) => a.student.name.localeCompare(b.student.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, classById, directory.teacherByUid, search, filter]);

  if (loading) return <Loading label="Loading students…" />;
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

  const guestCount = directory.guests.length;

  return (
    <Card
      title={`Students (${rows.length}${rows.length !== students.length ? ` of ${students.length}` : ''})`}
      hint={`${students.length - guestCount} in a class · ${guestCount} guest${guestCount === 1 ? '' : 's'} with no class`}
      actions={
        <>
          <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} style={{ width: 160 }}>
            <option value="all">All students</option>
            <option value="assigned">In a class</option>
            <option value="guest">Guests only</option>
          </Select>
          <Input
            placeholder="Search name, LRN, class code…"
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
          icon="🎓"
          title={students.length === 0 ? 'No students registered yet' : 'No student matches those filters'}
          hint={
            students.length === 0
              ? 'A student appears here as soon as they register in the JuanWise app.'
              : 'Clear the search box or switch the filter back to “All students”.'
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>LRN</th>
                <th>Grade &amp; section</th>
                <th>Teacher</th>
                <th>Class</th>
                <th>Class code</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ student, klass, teacher }) => (
                <tr key={student.uid}>
                  <td>
                    <div className="table__primary">{student.name}</div>
                    <div className="table__sub">@{student.username}</div>
                  </td>
                  <td className="table__sub">{student.lrn ?? '—'}</td>
                  <td className="table__sub">
                    {[student.grade ? `Grade ${student.grade}` : null, student.section]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td>
                    {teacher ? (
                      teacher.name
                    ) : (
                      <span className="table__sub">
                        {klass ? 'Teacher account missing' : 'No teacher'}
                      </span>
                    )}
                  </td>
                  <td>{klass ? klass.name : <Badge tone="gold">Guest</Badge>}</td>
                  <td>
                    {klass ? <Badge tone="code">{klass.code}</Badge> : <span className="table__sub">—</span>}
                  </td>
                  <td className="table__sub">{formatDate(student.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

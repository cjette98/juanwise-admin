import { useMemo } from 'react';
import { classesApi, usersApi, type ApiClass, type ApiUserProfile } from '@/shared/api';
import { useAsync } from '@/shared/lib/use-async';

export interface Directory {
  teachers: ApiUserProfile[];
  students: ApiUserProfile[];
  classes: ApiClass[];
  classById: Map<string, ApiClass>;
  teacherByUid: Map<string, ApiUserProfile>;
  /** Every class owned by a teacher, keyed on the teacher's uid. */
  classesByTeacher: Map<string, ApiClass[]>;
  /** Students with no class — the "guest" cohort on the leaderboard. */
  guests: ApiUserProfile[];
}

const EMPTY: Directory = {
  teachers: [],
  students: [],
  classes: [],
  classById: new Map(),
  teacherByUid: new Map(),
  classesByTeacher: new Map(),
  guests: [],
};

/**
 * Teachers, students and classes in one load, plus the lookups every table
 * needs.
 *
 * The three lists are always fetched together because none of the console's
 * questions can be answered by one of them alone: a student row has to show a
 * class code (classes) and the teacher who owns it (teachers), and a teacher
 * row has to show how many students joined.
 */
export function useDirectory() {
  const state = useAsync(
    async () => {
      const [teachers, students, classes] = await Promise.all([
        usersApi.listAll({ role: 'teacher' }),
        usersApi.listAll({ role: 'student' }),
        classesApi.all(),
      ]);
      return { teachers, students, classes };
    },
    [],
  );

  const directory = useMemo<Directory>(() => {
    if (!state.data) return EMPTY;
    const { teachers, students, classes } = state.data;

    const classById = new Map(classes.map((c) => [c.id, c]));
    const teacherByUid = new Map(teachers.map((t) => [t.uid, t]));

    const classesByTeacher = new Map<string, ApiClass[]>();
    for (const klass of classes) {
      const list = classesByTeacher.get(klass.teacherId);
      if (list) list.push(klass);
      else classesByTeacher.set(klass.teacherId, [klass]);
    }

    // A student whose class was deleted still carries its id, so "assigned" is
    // "the class still exists", not "classId is set".
    const guests = students.filter((s) => !s.classId || !classById.has(s.classId));

    return { teachers, students, classes, classById, teacherByUid, classesByTeacher, guests };
  }, [state.data]);

  return {
    ...directory,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
    loaded: state.data !== null,
  };
}

/** The teacher who owns the student's class, if the student is in one. */
export function teacherForStudent(
  student: ApiUserProfile,
  directory: Pick<Directory, 'classById' | 'teacherByUid'>,
): ApiUserProfile | null {
  const klass = student.classId ? directory.classById.get(student.classId) : null;
  return klass ? (directory.teacherByUid.get(klass.teacherId) ?? null) : null;
}

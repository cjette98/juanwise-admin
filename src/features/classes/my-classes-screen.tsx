import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  classesApi,
  errorMessage,
  packsApi,
  type ApiClass,
  type AssignPackRequest,
  type CreateClassRequest,
} from '@/shared/api';
import { Badge, Banner, Button, Card, ConfirmDialog, DataTable, Empty, Loading } from '@/shared/components/ui';
import { useAsync } from '@/shared/lib/use-async';
import { useAuth } from '@/features/auth/auth-context';
import { AssignPackDialog } from './assign-pack-dialog';
import { CreateClassDialog } from './create-class-dialog';

/**
 * A teacher's own classes and which content pack each one is currently
 * playing. This is the teacher-facing mirror of `pack-list-screen.tsx`'s
 * library: that screen manages the packs themselves, this one decides which
 * pack each class plays and how (shared live, or an independent copy).
 *
 * Loads both `classesApi.mine()` and `packsApi.list()` with a local
 * `Promise.all`, following `dashboard-screen.tsx`'s directness — this is the
 * only screen that needs this particular pairing, so it doesn't earn its own
 * shared hook the way `useDirectory` does for the admin screens.
 */
export default function MyClassesScreen() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([classesApi.mine(), packsApi.list()]).then(([classes, packs]) => ({
        classes,
        packs,
      })),
    [],
  );

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [assigningClass, setAssigningClass] = useState<ApiClass | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ApiClass | null>(null);
  // Correction 1, N2: a teacher clears out a class nobody is using.
  const [pendingDelete, setPendingDelete] = useState<ApiClass | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<ApiClass | null>(null);

  const classes = data?.classes ?? [];
  const packs = data?.packs ?? [];
  const packById = useMemo(() => new Map(packs.map((pack) => [pack.id, pack])), [packs]);

  const rows = useMemo(() => [...classes].sort((a, b) => a.name.localeCompare(b.name)), [classes]);

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    setBusyKey(key);
    setActionError(null);
    try {
      await action();
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  const assignPack = async (input: AssignPackRequest): Promise<ApiClass> => {
    if (!assigningClass) throw new Error('No class selected.');
    const result = await classesApi.assignPack(assigningClass.id, input);
    reload();
    return result;
  };

  const createClass = async (input: CreateClassRequest): Promise<ApiClass> => {
    const klass = await classesApi.create(input);
    setCreated(klass);
    reload();
    return klass;
  };

  const deleteClass = async () => {
    if (!pendingDelete) return;
    const klass = pendingDelete;
    setDeleting(true);
    setDeleteError(null);
    try {
      await classesApi.remove(klass.id);
      setPendingDelete(null);
      setDeleted(klass);
      setCreated(null);
      reload();
    } catch (err) {
      // The API says what it found (a student on the roster, recorded results).
      setDeleteError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Loading label="Loading your classes…" />;
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
      title={`My classes (${rows.length})`}
      hint="The content pack each of your classes is currently playing"
      actions={
        <>
          <Button variant="secondary" small onClick={reload}>
            Refresh
          </Button>
          <Button small onClick={() => setCreating(true)}>
            Create class
          </Button>
        </>
      }
      bodyless
    >
      {actionError && (
        <div style={{ padding: '12px 14px 0' }}>
          <Banner tone="error">{actionError}</Banner>
        </div>
      )}

      {created && (
        <div style={{ padding: '12px 14px 0' }}>
          <Banner tone="success">
            Created {created.name}. Students join with the code{' '}
            <Badge tone="code">{created.code}</Badge>.
          </Banner>
        </div>
      )}

      {deleted && (
        <div style={{ padding: '12px 14px 0' }}>
          <Banner tone="success">
            {deleted.name} was deleted and the code {deleted.code} is free again.
          </Banner>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty
          icon="🏫"
          title="No classes yet"
          hint="Create your first class with the Create class button — it shows up in the JuanWise app too."
        />
      ) : (
        <DataTable>
            <thead>
              <tr>
                <th>Class</th>
                <th>Code</th>
                <th className="table__num">Students</th>
                <th>Pack</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((klass) => {
                const pack = klass.packId ? packById.get(klass.packId) : undefined;
                return (
                  <tr key={klass.id}>
                    <td>
                      <Link to={`/my-classes/${klass.id}`} className="table__primary">
                        {klass.name}
                      </Link>
                      <div className="table__sub">
                        {[klass.gradeLevel ? `Grade ${klass.gradeLevel}` : null, klass.section]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </div>
                    </td>
                    <td>
                      <Badge tone="code">{klass.code}</Badge>
                    </td>
                    <td className="table__num">{klass.memberCount}</td>
                    <td>
                      {klass.packId ? (
                        <>
                          <div className="table__primary">{pack?.name ?? 'Unknown pack'}</div>
                          <div className="table__sub">
                            {klass.packBinding === 'copied' ? 'Independent copy' : 'Shared / linked'}
                          </div>
                        </>
                      ) : (
                        <span className="table__sub">No pack assigned — playing the starter set</span>
                      )}
                    </td>
                    <td>
                      <div className="row">
                        <Link to={`/my-classes/${klass.id}`}>
                          <Button variant="secondary" small>
                            Overview
                          </Button>
                        </Link>
                        <Button small onClick={() => setAssigningClass(klass)}>
                          {klass.packId ? 'Change pack' : 'Assign a pack'}
                        </Button>
                        {klass.packId && (
                          <Button
                            variant="secondary"
                            small
                            busy={busyKey === `${klass.id}:clear`}
                            onClick={() => runAction(`${klass.id}:clear`, () => classesApi.clearPack(klass.id))}
                          >
                            Clear
                          </Button>
                        )}
                        {klass.memberCount === 0 && (
                          <Button
                            variant="danger"
                            small
                            onClick={() => {
                              setDeleteError(null);
                              setPendingDelete(klass);
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? 'this class'}?`}
        confirmLabel="Yes, delete the class"
        cancelLabel="Keep the class"
        danger
        busy={deleting}
        onConfirm={deleteClass}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
      >
        <p>
          No student is on its roster. The class disappears here and in the JuanWise app, and the
          code {pendingDelete?.code} becomes free again. A class with recorded results cannot be
          deleted, because its results name it.
        </p>
        {deleteError && <Banner tone="error">{deleteError}</Banner>}
      </ConfirmDialog>

      <CreateClassDialog open={creating} onClose={() => setCreating(false)} onCreate={createClass} />

      {assigningClass && (
        <AssignPackDialog
          open
          classes={classes}
          currentClass={assigningClass}
          packs={packs}
          currentUserUid={user?.uid}
          onAssign={assignPack}
          onClose={() => setAssigningClass(null)}
        />
      )}
    </Card>
  );
}

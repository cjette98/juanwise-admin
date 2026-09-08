import { useMemo, useState } from 'react';
import {
  classesApi,
  errorMessage,
  packsApi,
  type ApiClass,
  type AssignPackRequest,
} from '@/shared/api';
import { Badge, Banner, Button, Card, Empty, Loading } from '@/shared/components/ui';
import { useAsync } from '@/shared/lib/use-async';
import { useAuth } from '@/features/auth/auth-context';
import { AssignPackDialog } from './assign-pack-dialog';

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
        <Button variant="secondary" small onClick={reload}>
          Refresh
        </Button>
      }
      bodyless
    >
      {actionError && (
        <div style={{ padding: '12px 14px 0' }}>
          <Banner tone="error">{actionError}</Banner>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty
          icon="🏫"
          title="No classes yet"
          hint="Create a class in the JuanWise app to see it here."
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
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
                      <div className="table__primary">{klass.name}</div>
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage, packsApi, type ApiPackStatus } from '@/shared/api';
import { Badge, Banner, Button, Card, Empty, Field, Input, Loading } from '@/shared/components/ui';
import { useAsync } from '@/shared/lib/use-async';
import { matchesSearch } from '@/shared/lib/format';
import { useAuth } from '@/features/auth/auth-context';

const STATUS_TONE: Record<ApiPackStatus, 'default' | 'green' | 'red'> = {
  draft: 'default',
  published: 'green',
  archived: 'red',
};

const STATUS_LABEL: Record<ApiPackStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

/**
 * The library of content packs: a teacher's own drafts and every pack anyone
 * has published, in one list — `packsApi.list()` (`mine=false`) is exactly
 * that union, per the backend's `listPacksFor`.
 *
 * Editing lives on two other screens (Quiz, Jigsaw) that this screen only
 * links into — a pack row is a launching point, not where content is typed.
 */
export default function PackListScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: packs, loading, error, reload } = useAsync(() => packsApi.list(), []);

  const [search, setSearch] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newPackOpen, setNewPackOpen] = useState(false);

  const rows = useMemo(
    () => (packs ?? []).filter((pack) => matchesSearch(search, pack.name)).sort((a, b) => a.name.localeCompare(b.name)),
    [packs, search],
  );

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

  const createPack = async (name: string) => {
    const pack = await packsApi.create(name);
    reload();
    navigate(`/packs/${pack.id}/quiz`);
  };

  if (loading) return <Loading label="Loading packs…" />;
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

  const all = packs ?? [];

  return (
    <Card
      title={`Content packs (${rows.length}${rows.length !== all.length ? ` of ${all.length}` : ''})`}
      hint="Your own packs plus every pack any teacher has published"
      actions={
        <>
          <Input
            placeholder="Search pack name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
          <Button variant="secondary" small onClick={reload}>
            Refresh
          </Button>
          <Button small onClick={() => setNewPackOpen(true)}>
            New pack
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

      {rows.length === 0 ? (
        <Empty
          icon="📦"
          title={all.length === 0 ? 'No content packs yet' : 'No pack matches that search'}
          hint={
            all.length === 0
              ? 'Create a pack to start authoring quiz and jigsaw content of your own.'
              : 'Try a different pack name.'
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Pack</th>
                <th>Status</th>
                <th className="table__num">Version</th>
                <th>Used by</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pack) => {
                const owned = pack.ownerUid === user?.uid || user?.role === 'admin';
                return (
                  <tr key={pack.id}>
                    <td>
                      <div className="table__primary">{pack.name}</div>
                      <div className="table__sub">
                        {pack.origin === 'system' ? 'Built-in starter set' : owned ? 'Yours' : 'By another teacher'}
                      </div>
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[pack.status]}>{STATUS_LABEL[pack.status]}</Badge>
                    </td>
                    <td className="table__num">{pack.version}</td>
                    <td className="table__sub">
                      {pack.classCount > 0
                        ? `used by ${pack.classCount} class${pack.classCount === 1 ? '' : 'es'}`
                        : 'not in use'}
                    </td>
                    <td>
                      <div className="row">
                        {owned && (
                          <>
                            <Link to={`/packs/${pack.id}/quiz`}>
                              <Button variant="secondary" small>
                                Edit quiz
                              </Button>
                            </Link>
                            <Link to={`/packs/${pack.id}/jigsaw`}>
                              <Button variant="secondary" small>
                                Edit jigsaw
                              </Button>
                            </Link>
                          </>
                        )}
                        <Button
                          variant="secondary"
                          small
                          busy={busyKey === `${pack.id}:duplicate`}
                          onClick={() => runAction(`${pack.id}:duplicate`, () => packsApi.duplicate(pack.id))}
                        >
                          Duplicate
                        </Button>
                        {owned && pack.status !== 'published' && (
                          <Button
                            small
                            busy={busyKey === `${pack.id}:publish`}
                            onClick={() => runAction(`${pack.id}:publish`, () => packsApi.publish(pack.id))}
                          >
                            Publish
                          </Button>
                        )}
                        {owned && pack.status !== 'archived' && (
                          <Button
                            variant="danger"
                            small
                            busy={busyKey === `${pack.id}:archive`}
                            onClick={() => runAction(`${pack.id}:archive`, () => packsApi.archive(pack.id))}
                          >
                            Archive
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

      <NewPackDialog open={newPackOpen} onClose={() => setNewPackOpen(false)} onCreate={createPack} />
    </Card>
  );
}

/**
 * A name-prompt modal. `ui.tsx` only has `ConfirmDialog`, which has no room for
 * an input, so this follows its own implementation as the template — the same
 * native `<dialog>` element, opened imperatively via `showModal()`, with
 * Escape treated as cancel.
 */
function NewPackDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const cancel = () => {
    if (busy) return;
    onClose();
  };

  const confirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the pack a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate(trimmed);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <h2 className="dialog__title" id={titleId}>
        New pack
      </h2>
      <div className="dialog__body">
        <Field label="Pack name" error={error}>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grade 6 – Second Quarter"
          />
        </Field>
      </div>
      <div className="dialog__actions">
        <Button variant="secondary" onClick={cancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={confirm} busy={busy}>
          Create pack
        </Button>
      </div>
    </dialog>
  );
}

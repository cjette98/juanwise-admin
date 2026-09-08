import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { errorMessage, packsApi } from '@/shared/api';
import type { ApiClass, ApiPack, AssignPackRequest } from '@/shared/api';
import { Banner, Button, Field, Select } from '@/shared/components/ui';

interface AssignPackDialogProps {
  open: boolean;
  classes: ApiClass[];
  currentClass: ApiClass;
  packs: ApiPack[];
  /** The signed-in teacher's uid — used only to tell "my pack" from "someone else's" for the cross-teacher sharing banner. */
  currentUserUid: string | null | undefined;
  onAssign: (input: AssignPackRequest) => Promise<ApiClass>;
  onClose: () => void;
}

/**
 * The walkthrough's "share or copy" screen: pick a pack, then decide whether
 * this class links to the same content every other class assigned to it sees
 * live, or gets its own independent copy.
 *
 * Built on the same native `<dialog>` mechanics as `ConfirmDialog` — the only
 * existing modal in this codebase — because the two outcomes here ("Share
 * it" / "Make a copy") don't fit `ConfirmDialog`'s single confirm button, the
 * same reasoning `NewPackDialog` in `pack-list-screen.tsx` follows for its own
 * shape mismatch.
 */
export function AssignPackDialog({
  open,
  classes,
  currentClass,
  packs,
  currentUserUid,
  onAssign,
  onClose,
}: AssignPackDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const [packId, setPackId] = useState('');
  // Tracks which of the two actions is in flight, so only that button shows a
  // spinner while both are disabled.
  const [submitting, setSubmitting] = useState<'link' | 'copy' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Guarded both ways: showModal() on an open dialog throws, and close() on a
    // closed one fires a spurious `close` event.
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open) {
      setPackId(currentClass.packId ?? '');
      setSubmitting(null);
      setError(null);
    }
  }, [open, currentClass]);

  // Every other class already pointed at the picked pack — the sharing
  // consequence is about them, not about `currentClass`.
  const otherClassesWithSamePack = useMemo(
    () => (packId ? classes.filter((c) => c.id !== currentClass.id && c.packId === packId) : []),
    [classes, currentClass.id, packId],
  );

  // Every class that would end up on the picked pack after this assignment —
  // `currentClass` always included, whether or not it's already on it.
  const affectedLearners = useMemo(() => {
    if (!packId) return 0;
    return classes
      .filter((c) => c.id === currentClass.id || c.packId === packId)
      .reduce((sum, c) => sum + c.memberCount, 0);
  }, [classes, currentClass.id, packId]);

  const selectedPack = useMemo(() => packs.find((p) => p.id === packId) ?? null, [packs, packId]);

  const cancel = () => {
    if (submitting) return;
    onClose();
  };

  const submit = async (mode: 'link' | 'copy') => {
    if (!packId) {
      setError('Choose a pack first.');
      return;
    }
    setSubmitting(mode);
    setError(null);
    try {
      // `mode` is sent explicitly even though the server defaults to 'link' —
      // the UI's own recommendation ("Share it") and what's actually sent
      // must never drift apart.
      const result = await onAssign({ packId, mode });
      if (mode === 'copy' && result.packId) {
        // The server always forks "Make a copy" as a fresh draft (version 0),
        // which would otherwise silently fall back to the system pack for
        // students until someone separately published it. The fork is
        // copy-on-write identical to the source pack at this instant, so
        // publishing it immediately is safe and makes "Make a copy" a single
        // working step instead of a silent no-op. Left inside this same
        // try/catch: if this fails, the class IS assigned to the (still
        // draft) fork, so the error must surface rather than be swallowed.
        await packsApi.publish(result.packId);
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(null);
    }
  };

  const busy = submitting !== null;

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
        Assign a pack to {currentClass.name}
      </h2>
      <div className="dialog__body">
        <Field label="Content pack">
          <Select value={packId} onChange={(e) => setPackId(e.target.value)} disabled={busy} autoFocus>
            <option value="" disabled>
              Choose a pack…
            </option>
            {packs.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.name}
              </option>
            ))}
          </Select>
        </Field>

        {otherClassesWithSamePack.length > 0 && (
          <Banner tone="info">
            This pack is already used by {otherClassesWithSamePack.length} other class
            {otherClassesWithSamePack.length === 1 ? '' : 'es'}. Sharing it here would mean{' '}
            {affectedLearners} learner{affectedLearners === 1 ? '' : 's'} across{' '}
            {otherClassesWithSamePack.length + 1} classes see the same activities.
          </Banner>
        )}

        {selectedPack && selectedPack.status !== 'published' && (
          <Banner tone="info">
            This pack is still a {selectedPack.status === 'draft' ? 'draft' : 'archived'}. Students in
            this class won't see its activities until you publish it — they'll keep playing the starter
            set until then.
          </Banner>
        )}

        {selectedPack && selectedPack.ownerUid !== currentUserUid && selectedPack.classCount > 0 && (
          <Banner tone="info">
            This pack is already used by {selectedPack.classCount} other class
            {selectedPack.classCount === 1 ? '' : 'es'} outside the ones you handle.
          </Banner>
        )}

        {error && <Banner tone="error">{error}</Banner>}
      </div>
      <div className="dialog__actions">
        <Button variant="secondary" onClick={cancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          busy={submitting === 'copy'}
          disabled={busy || !packId}
          onClick={() => submit('copy')}
        >
          Make a copy
        </Button>
        <Button busy={submitting === 'link'} disabled={busy || !packId} onClick={() => submit('link')}>
          Share it
        </Button>
      </div>
    </dialog>
  );
}

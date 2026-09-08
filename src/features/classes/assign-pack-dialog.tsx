import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { errorMessage } from '@/shared/api';
import type { ApiClass, ApiPack, AssignPackRequest } from '@/shared/api';
import { Banner, Button, Field, Select } from '@/shared/components/ui';

interface AssignPackDialogProps {
  open: boolean;
  classes: ApiClass[];
  currentClass: ApiClass;
  packs: ApiPack[];
  onAssign: (input: AssignPackRequest) => Promise<void>;
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
      await onAssign({ packId, mode });
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

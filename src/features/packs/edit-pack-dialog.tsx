import { useEffect, useId, useRef, useState } from 'react';
import { errorMessage, type ApiPack, type PatchPackRequest } from '@/shared/api';
import { Banner, Button, Field, Input } from '@/shared/components/ui';

const MAX_PACK_NAME = 80;

/**
 * Rename a pack and turn its mini-lessons on or off — `PATCH /packs/{id}`
 * already took both, but the console had no screen for it (item 10 of
 * Adjustment 3: the terms promise that packs can be edited). Only the fields
 * that changed are sent.
 */
export function EditPackDialog({
  pack,
  onClose,
  onSave,
}: {
  pack: ApiPack | null;
  onClose: () => void;
  onSave: (id: string, patch: PatchPackRequest) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [name, setName] = useState('');
  const [showMiniLesson, setShowMiniLesson] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = pack !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!pack) return;
    setName(pack.name);
    setShowMiniLesson(pack.showMiniLesson);
    setError(null);
    setBusy(false);
  }, [pack]);

  const cancel = () => {
    if (!busy) onClose();
  };

  const save = async () => {
    if (!pack) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the pack a name.');
      return;
    }
    const patch: PatchPackRequest = {};
    if (trimmed !== pack.name) patch.name = trimmed;
    if (showMiniLesson !== pack.showMiniLesson) patch.showMiniLesson = showMiniLesson;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onSave(pack.id, patch);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'The pack could not be saved.'));
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
        Edit pack
      </h2>
      <form
        className="dialog__body grid"
        style={{ gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Field label="Pack name">
          <Input
            value={name}
            maxLength={MAX_PACK_NAME}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <label className="check">
          <input
            type="checkbox"
            checked={showMiniLesson}
            onChange={(e) => setShowMiniLesson(e.target.checked)}
          />
          <span>
            <span className="check__label">Show mini-lessons</span>
            <span className="field__hint">
              After each activity, players in classes using this pack see its mini-lesson.
            </span>
          </span>
        </label>
        {error && <Banner tone="error">{error}</Banner>}
        <button type="submit" hidden />
      </form>
      <div className="dialog__actions">
        <Button variant="secondary" onClick={cancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={save} busy={busy}>
          Save changes
        </Button>
      </div>
    </dialog>
  );
}

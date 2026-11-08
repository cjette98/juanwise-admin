import { useEffect, useId, useRef, useState } from 'react';
import { errorMessage, type ApiClass, type CreateClassRequest } from '@/shared/api';
import { Banner, Button, Field, Input, Select } from '@/shared/components/ui';

const GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MAX_NAME = 80;
const MAX_SECTION = 40;
const SECTION_PATTERN = /^[A-Za-z0-9]+$/;

/**
 * Create a class from the web (item 4 of Adjustment 3 — the client confirmed
 * teachers do this here as well as in the app). The rules mirror juanwise-be
 * `createClassSchema` so a bad value is caught before the round trip; the
 * server's message still shows if it refuses anyway.
 */
export function CreateClassDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateClassRequest) => Promise<ApiClass>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setName('');
    setGrade('');
    setSection('');
    setError(null);
    setNameError(null);
    setSectionError(null);
    setBusy(false);
  }, [open]);

  const cancel = () => {
    if (!busy) onClose();
  };

  const confirm = async () => {
    const trimmedName = name.trim();
    const trimmedSection = section.trim();
    const badName = trimmedName ? null : 'Give the class a name.';
    const badSection =
      trimmedSection && !SECTION_PATTERN.test(trimmedSection)
        ? 'Use letters and numbers only.'
        : null;
    setNameError(badName);
    setSectionError(badSection);
    if (badName || badSection) return;

    setBusy(true);
    setError(null);
    try {
      await onCreate({
        name: trimmedName,
        gradeLevel: grade || undefined,
        section: trimmedSection || undefined,
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'The class could not be created.'));
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
        Create a class
      </h2>
      <form
        className="dialog__body grid"
        style={{ gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          void confirm();
        }}
      >
        <p>
          A class code is made for you. Students type it in the JuanWise app to join, and the class
          shows up in the app as well.
        </p>
        <Field label="Class name" error={nameError}>
          <Input
            autoFocus
            value={name}
            maxLength={MAX_NAME}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grade 6 – Mabini"
          />
        </Field>
        <div className="grid grid--2" style={{ gap: 12 }}>
          <Field label="Grade (optional)">
            <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">No grade</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Section (optional)" error={sectionError}>
            <Input
              value={section}
              maxLength={MAX_SECTION}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g. Mabini"
            />
          </Field>
        </div>
        {error && <Banner tone="error">{error}</Banner>}
        {/* Enter in a field submits; the visible buttons live below the form. */}
        <button type="submit" hidden />
      </form>
      <div className="dialog__actions">
        <Button variant="secondary" onClick={cancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={confirm} busy={busy}>
          Create class
        </Button>
      </div>
    </dialog>
  );
}

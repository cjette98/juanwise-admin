import { useState } from 'react';
import { errorMessage, usersApi, type ApiUserProfile } from '@/shared/api';
import { Banner, ConfirmDialog, Field, PasswordInput } from '@/shared/components/ui';

/**
 * The two account actions the client asked for — deleting an unused account
 * (item W2.1) and setting a student's password (item W4.1) — shared by the
 * Students and Teachers pages.
 *
 * One dialog per screen rather than one per row: `ConfirmDialog` keeps its
 * `<dialog>` in the document whether it is open or not, and a roster of two
 * hundred students would otherwise put two hundred of them there.
 */

export const MIN_PASSWORD = 8;

type Pending = { kind: 'delete' | 'password'; user: ApiUserProfile };

/**
 * Whether the account looks untouched from what the console can see. The API
 * makes the real decision — it can also see results and saved progress — so
 * this only decides whether offering the button makes sense.
 */
export function looksUnused(user: ApiUserProfile, ownsClasses = false): boolean {
  return !user.lastLoginAt && !user.classId && !ownsClasses;
}

export interface AccountActions {
  pending: Pending | null;
  busy: boolean;
  error: string | null;
  notice: string | null;
  password: string;
  setPassword: (value: string) => void;
  askDelete: (user: ApiUserProfile) => void;
  askPassword: (user: ApiUserProfile) => void;
  cancel: () => void;
  confirm: () => void;
  dismissNotice: () => void;
}

export function useAccountActions(onDone: () => void): AccountActions {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  const open = (kind: Pending['kind'], user: ApiUserProfile) => {
    setPending({ kind, user });
    setError(null);
    setNotice(null);
    setPassword('');
  };

  const cancel = () => {
    if (busy) return;
    setPending(null);
    setError(null);
  };

  const confirm = () => {
    if (!pending || busy) return;
    const { kind, user } = pending;

    setBusy(true);
    setError(null);

    const run =
      kind === 'delete'
        ? usersApi.remove(user.uid).then(() => `${user.name}'s account was deleted.`)
        : usersApi
            .setPassword(user.uid, password)
            .then(
              () =>
                `${user.name}'s password was changed. Read the new password out to them — it is not shown again.`,
            );

    run
      .then((message) => {
        setPending(null);
        setNotice(message);
        onDone();
      })
      // The refusal is the useful part — the API names what it found, so it is
      // shown inside the dialog where the admin is still looking.
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setBusy(false));
  };

  return {
    pending,
    busy,
    error,
    notice,
    password,
    setPassword,
    askDelete: (user) => open('delete', user),
    askPassword: (user) => open('password', user),
    cancel,
    confirm,
    dismissNotice: () => setNotice(null),
  };
}

/** The success line, shown above the table after an action went through. */
export function AccountNotice({ actions }: { actions: AccountActions }) {
  if (!actions.notice) return null;
  return <Banner tone="success">{actions.notice}</Banner>;
}

export function AccountActionDialogs({ actions }: { actions: AccountActions }) {
  const { pending, busy, error, password, setPassword } = actions;
  const user = pending?.user;
  // Both dialogs stay in the document, so the error has to be pinned to the
  // one that is actually open or it renders twice.
  const errorFor = (kind: Pending['kind']) => (pending?.kind === kind ? error : null);
  const role = user?.role === 'teacher' ? 'teacher' : 'student';

  return (
    <>
      <ConfirmDialog
        open={pending?.kind === 'delete'}
        title={`Delete ${user?.name ?? 'this account'}?`}
        confirmLabel="Yes, delete the account"
        cancelLabel="Keep the account"
        danger
        busy={busy}
        onConfirm={actions.confirm}
        onCancel={actions.cancel}
      >
        <p>
          This removes the {role} account @{user?.username} for good. Only an account that was
          registered and never used can go — the server refuses the rest.
        </p>
        {errorFor('delete') && <Banner tone="error">{errorFor('delete')}</Banner>}
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === 'password'}
        title={`Set a new password for ${user?.name ?? 'this account'}?`}
        confirmLabel="Set the password"
        cancelLabel="Cancel"
        busy={busy}
        confirmDisabled={password.length < MIN_PASSWORD}
        onConfirm={actions.confirm}
        onCancel={actions.cancel}
      >
        <p>
          For a student who cannot use the emailed reset. They are signed out everywhere, and the
          app tells them their password was changed the next time they sign in.
        </p>
        <Field
          label="New password"
          hint={`At least ${MIN_PASSWORD} characters. Read it out to the student — it is not shown again.`}
        >
          <PasswordInput
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            disabled={busy}
          />
        </Field>
        {errorFor('password') && <Banner tone="error">{errorFor('password')}</Banner>}
      </ConfirmDialog>
    </>
  );
}

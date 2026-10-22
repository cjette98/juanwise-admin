import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ApiClass, ApiUserProfile } from '@/shared/api';

/**
 * Items W2.1-W2.3 and W4.1 of the client evaluation: the registration and
 * last-login columns, the Delete button limited to accounts that were never
 * used, and setting a student's password.
 */

const usersApi = vi.hoisted(() => ({
  listAll: vi.fn(),
  remove: vi.fn(),
  setPassword: vi.fn(),
}));
const classesApi = vi.hoisted(() => ({ all: vi.fn() }));

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  usersApi,
  classesApi,
}));

const { default: StudentsScreen } = await import('./students-screen');

const base: ApiUserProfile = {
  uid: 'student-1',
  role: 'student',
  name: 'Ana Reyes',
  username: 'anareyes',
  email: 'ana@gmail.com',
  avatar: null,
  photoUrl: null,
  age: 11,
  grade: '6',
  section: 'Infinity1',
  lrn: '123456789012',
  teacherId: null,
  classId: null,
  registered: true,
  disabled: false,
  createdAt: '2026-10-01T06:30:00.000Z',
  updatedAt: null,
  lastLoginAt: null,
  passwordResetAt: null,
};

const played: ApiUserProfile = {
  ...base,
  uid: 'student-2',
  name: 'Ben Cruz',
  username: 'bencruz',
  classId: 'class-1',
  lastLoginAt: '2026-10-20T01:15:00.000Z',
};

const klass: ApiClass = {
  id: 'class-1',
  code: 'ABCDEFGHJK',
  name: 'Grade 6 Rizal',
  teacherId: 'teacher-1',
  gradeLevel: '6',
  section: 'Rizal2',
  assignment: null,
  packId: null,
  packBinding: null,
  packVersion: null,
  memberCount: 1,
  archived: false,
  createdAt: null,
  updatedAt: null,
};

function setup(students: ApiUserProfile[] = [base, played]) {
  usersApi.listAll.mockImplementation(({ role }: { role: string }) =>
    Promise.resolve(role === 'student' ? students : []),
  );
  classesApi.all.mockResolvedValue([klass]);
  usersApi.remove.mockResolvedValue(undefined);
  usersApi.setPassword.mockResolvedValue(base);
  render(<StudentsScreen />);
  return userEvent.setup();
}

const rowFor = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

describe('the students table', () => {
  it('shows when each account registered and last signed in', async () => {
    setup();
    await screen.findByText('Ana Reyes');

    // The exact string is locale-dependent; the year and the time separator
    // are what distinguish a date-and-time from the date alone. Ben has both
    // a registration and a last-login cell; Ana has only the first.
    expect(within(rowFor('Ben Cruz')).getAllByText(/2026.*:\d\d/)).toHaveLength(2);
    expect(within(rowFor('Ana Reyes')).getAllByText(/2026.*:\d\d/)).toHaveLength(1);
    expect(within(rowFor('Ana Reyes')).getByText('Never signed in')).toBeInTheDocument();
  });

  it('offers Delete only for an account that was never used', async () => {
    setup();
    await screen.findByText('Ana Reyes');

    expect(within(rowFor('Ana Reyes')).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(within(rowFor('Ben Cruz')).queryByRole('button', { name: 'Delete' })).toBeNull();
  });
});

describe('deleting an account', () => {
  it('asks first, then deletes', async () => {
    const user = setup();
    await screen.findByText('Ana Reyes');

    await user.click(within(rowFor('Ana Reyes')).getByRole('button', { name: 'Delete' }));
    expect(usersApi.remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Yes, delete the account' }));
    await waitFor(() => expect(usersApi.remove).toHaveBeenCalledWith('student-1'));
    expect(await screen.findByText(/account was deleted/)).toBeInTheDocument();
  });

  it("keeps the dialog up and shows the server's reason when it refuses", async () => {
    const user = setup();
    const { ApiError } = await import('@/shared/api');
    usersApi.remove.mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'This account has signed in. Only accounts that were never used can be deleted.'),
    );
    await screen.findByText('Ana Reyes');

    await user.click(within(rowFor('Ana Reyes')).getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete the account' }));

    expect(await screen.findByText(/This account has signed in/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
  });
});

describe('setting a password', () => {
  it('refuses to submit anything shorter than eight characters', async () => {
    const user = setup();
    await screen.findByText('Ana Reyes');

    await user.click(within(rowFor('Ana Reyes')).getByRole('button', { name: 'Reset password' }));
    const confirm = screen.getByRole('button', { name: 'Set the password' });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/New password/), 'Str0ng!pass');
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    await waitFor(() => expect(usersApi.setPassword).toHaveBeenCalledWith('student-1', 'Str0ng!pass'));
    expect(await screen.findByText(/Read the new password out to them/)).toBeInTheDocument();
  });
});

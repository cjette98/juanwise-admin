import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ApiCurrentUser } from '@/shared/api';

/**
 * Covers the sign-out confirmation (item W1.1 of the client evaluation): the
 * console used to sign out on the click alone, while the mobile app already
 * asked first.
 */
const useAuthMock = vi.fn();

vi.mock('@/features/auth/auth-context', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => useAuthMock(),
}));

const { default: AdminLayout } = await import('./layout');

const admin: ApiCurrentUser = {
  uid: 'admin-1',
  role: 'admin',
  name: 'Main Admin',
  username: 'admin',
  email: 'admin@example.com',
  avatar: null,
  photoUrl: null,
  age: null,
  grade: null,
  section: null,
  lrn: null,
  teacherId: null,
  classId: null,
  registered: true,
  disabled: false,
  createdAt: null,
  updatedAt: null,
  lastLoginAt: null,
  passwordResetAt: null,
  claims: {},
  emailVerified: true,
};

function renderLayout() {
  const signOut = vi.fn().mockResolvedValue(undefined);
  useAuthMock.mockReturnValue({ user: admin, restoring: false, signIn: vi.fn(), signOut });
  render(
    <MemoryRouter initialEntries={['/']}>
      <AdminLayout />
    </MemoryRouter>,
  );
  return { signOut, user: userEvent.setup() };
}

describe('AdminLayout sign out', () => {
  it('asks before signing out', async () => {
    const { signOut, user } = renderLayout();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('signs out once confirmed', async () => {
    const { signOut, user } = renderLayout();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await user.click(screen.getByRole('button', { name: 'Yes, sign out' }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('stays signed in when the confirmation is declined', async () => {
    const { signOut, user } = renderLayout();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await user.click(screen.getByRole('button', { name: 'No, stay signed in' }));

    expect(signOut).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });
});

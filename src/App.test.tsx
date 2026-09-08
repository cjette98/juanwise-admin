import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import type { ApiCurrentUser } from '@/shared/api';

/**
 * Focused on the `RequireRole` route guard added in this fix wave — every
 * screen is stubbed out so this only exercises routing/redirect behavior,
 * not each screen's own data loading (already covered by their own test
 * files).
 */
const useAuthMock = vi.fn();

vi.mock('@/features/auth/auth-context', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => useAuthMock(),
}));

vi.mock('@/app/layout', () => ({ default: () => <Outlet /> }));
vi.mock('@/features/auth/login-screen', () => ({ default: () => <div>Login screen</div> }));
vi.mock('@/features/classes/my-classes-screen', () => ({ default: () => <div>My classes screen</div> }));
vi.mock('@/features/dashboard/dashboard-screen', () => ({ default: () => <div>Dashboard screen</div> }));
vi.mock('@/features/jigsaw/jigsaw-screen', () => ({ default: () => <div>Jigsaw screen</div> }));
vi.mock('@/features/leaderboard/leaderboard-screen', () => ({ default: () => <div>Leaderboard screen</div> }));
vi.mock('@/features/packs/pack-list-screen', () => ({ default: () => <div>Pack list screen</div> }));
vi.mock('@/features/quiz/quiz-screen', () => ({ default: () => <div>Quiz screen</div> }));
vi.mock('@/features/students/students-screen', () => ({ default: () => <div>Students screen</div> }));
vi.mock('@/features/teachers/teachers-screen', () => ({ default: () => <div>Teachers screen</div> }));

const { default: App } = await import('./App');

const teacher: ApiCurrentUser = {
  uid: 'teacher-1',
  role: 'teacher',
  name: 'Teacher One',
  username: 'teacher1',
  email: 'teacher1@example.com',
  avatar: null,
  photoUrl: null,
  age: null,
  grade: null,
  section: null,
  lrn: null,
  teacherId: 'T-1',
  classId: null,
  registered: true,
  disabled: false,
  createdAt: null,
  updatedAt: null,
  claims: {},
  emailVerified: true,
};

const admin: ApiCurrentUser = { ...teacher, uid: 'admin-1', role: 'admin' };

const renderAt = (path: string, user: ApiCurrentUser) => {
  useAuthMock.mockReturnValue({ user, restoring: false, signIn: vi.fn(), signOut: vi.fn() });
  window.history.pushState({}, '', path);
  render(<App />);
};

describe('route role guard', () => {
  it('lets an admin reach an admin-only route', async () => {
    renderAt('/teachers', admin);
    expect(await screen.findByText('Teachers screen')).toBeInTheDocument();
  });

  it("redirects a teacher away from an admin-only route to the teacher's landing page", async () => {
    renderAt('/teachers', teacher);
    expect(await screen.findByText('Pack list screen')).toBeInTheDocument();
    expect(screen.queryByText('Teachers screen')).not.toBeInTheDocument();
  });

  it('lets a teacher reach the teacher-only route', async () => {
    renderAt('/my-classes', teacher);
    expect(await screen.findByText('My classes screen')).toBeInTheDocument();
  });

  it("redirects an admin away from the teacher-only route to the admin's landing page", async () => {
    renderAt('/my-classes', admin);
    expect(await screen.findByText('Dashboard screen')).toBeInTheDocument();
    expect(screen.queryByText('My classes screen')).not.toBeInTheDocument();
  });
});

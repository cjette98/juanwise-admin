import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ApiClass, ApiUserProfile } from '@/shared/api';

/**
 * Item W3.1 of the client evaluation: deleting an inactive class from the
 * dashboard. The Delete button is offered only where it can work — a class
 * with a roster is kept, and the server refuses it anyway.
 */

const usersApi = vi.hoisted(() => ({ listAll: vi.fn() }));
const classesApi = vi.hoisted(() => ({ all: vi.fn(), remove: vi.fn() }));

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  usersApi,
  classesApi,
}));

const { default: DashboardScreen } = await import('./dashboard-screen');

const teacher = {
  uid: 'teacher-1',
  role: 'teacher',
  name: 'Maria Cruz',
  username: 'mariac',
  email: 'maria@deped.gov.ph',
  avatar: null,
  photoUrl: null,
  age: null,
  grade: null,
  section: null,
  lrn: null,
  teacherId: '1234567',
  classId: null,
  registered: true,
  disabled: false,
  createdAt: null,
  updatedAt: null,
  lastLoginAt: null,
  passwordResetAt: null,
} satisfies ApiUserProfile;

const emptyClass: ApiClass = {
  id: 'class-empty',
  code: 'EMPTYCODE1',
  name: 'Grade 6 Mabini',
  teacherId: 'teacher-1',
  gradeLevel: '6',
  section: 'Mabini1',
  assignment: null,
  packId: null,
  packBinding: null,
  packVersion: null,
  memberCount: 0,
  archived: false,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: null,
};

const busyClass: ApiClass = {
  ...emptyClass,
  id: 'class-busy',
  code: 'BUSYCODE22',
  name: 'Grade 6 Rizal',
  memberCount: 12,
  createdAt: '2026-10-21T00:00:00.000Z',
};

function setup() {
  usersApi.listAll.mockImplementation(({ role }: { role: string }) =>
    Promise.resolve(role === 'teacher' ? [teacher] : []),
  );
  classesApi.all.mockResolvedValue([emptyClass, busyClass]);
  classesApi.remove.mockResolvedValue(undefined);
  render(
    <MemoryRouter>
      <DashboardScreen />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

const rowFor = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

describe('deleting a class', () => {
  it('offers Delete only on a class nobody joined', async () => {
    setup();
    await screen.findByText('Grade 6 Mabini');

    expect(within(rowFor('Grade 6 Mabini')).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(within(rowFor('Grade 6 Rizal')).queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('asks first, then deletes and says the code is free', async () => {
    const user = setup();
    await screen.findByText('Grade 6 Mabini');

    await user.click(within(rowFor('Grade 6 Mabini')).getByRole('button', { name: 'Delete' }));
    expect(classesApi.remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Yes, delete the class' }));
    await waitFor(() => expect(classesApi.remove).toHaveBeenCalledWith('class-empty'));
    expect(await screen.findByText(/EMPTYCODE1 is free again/)).toBeInTheDocument();
  });

  it("shows the server's refusal without closing the dialog", async () => {
    const user = setup();
    const { ApiError } = await import('@/shared/api');
    classesApi.remove.mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'This class has recorded results, so it cannot be deleted.'),
    );
    await screen.findByText('Grade 6 Mabini');

    await user.click(within(rowFor('Grade 6 Mabini')).getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete the class' }));

    expect(await screen.findByText(/This class has recorded results/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
  });

  it('lists every empty class, not just the newest six', async () => {
    const user = setup();
    await screen.findByText('Grade 6 Mabini');

    await user.selectOptions(screen.getByRole('combobox'), 'empty');

    expect(screen.getByText('Classes with nobody joined')).toBeInTheDocument();
    expect(screen.queryByText('Grade 6 Rizal')).toBeNull();
  });
});

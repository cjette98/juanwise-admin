import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ApiCurrentUser, ApiPack } from '@/shared/api';

const list = vi.fn();
const create = vi.fn();
const duplicate = vi.fn();
const publish = vi.fn();
const archive = vi.fn();

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  packsApi: {
    list: (...args: unknown[]) => list(...args),
    create: (...args: unknown[]) => create(...args),
    duplicate: (...args: unknown[]) => duplicate(...args),
    publish: (...args: unknown[]) => publish(...args),
    archive: (...args: unknown[]) => archive(...args),
  },
  errorMessage: (err: unknown, fallback = 'error') =>
    err instanceof Error ? err.message : fallback,
}));

const currentUser: ApiCurrentUser = {
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

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({
    user: currentUser,
    restoring: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

const { default: PackListScreen } = await import('./pack-list-screen');

const pack = (over: Partial<ApiPack> = {}): ApiPack => ({
  id: 'pack-1',
  name: 'Grade 6 – Q1',
  ownerUid: 'teacher-1',
  origin: 'teacher',
  forkedFrom: null,
  status: 'draft',
  version: 1,
  publishedAt: null,
  showMiniLesson: true,
  classCount: 0,
  createdAt: null,
  updatedAt: null,
  ...over,
});

const renderScreen = async (packs: ApiPack[] = [pack()]) => {
  list.mockResolvedValue(packs);
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PackListScreen />
    </MemoryRouter>,
  );
  await screen.findByText(packs[0]?.name ?? 'No content packs yet');
  return { user };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pack list', () => {
  it('renders packs from packsApi.list', async () => {
    await renderScreen([
      pack({ id: 'pack-1', name: 'Grade 6 – Q1' }),
      pack({ id: 'pack-2', name: 'Grade 7 – Q1', status: 'published', ownerUid: 'someone-else' }),
    ]);

    expect(screen.getByText('Grade 6 – Q1')).toBeInTheDocument();
    expect(screen.getByText('Grade 7 – Q1')).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('creating a pack calls packsApi.create with the typed name', async () => {
    const { user } = await renderScreen([]);
    create.mockResolvedValue(pack({ id: 'new-pack', name: 'Brand new pack' }));

    await user.click(screen.getByRole('button', { name: 'New pack' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(screen.getByPlaceholderText(/e\.g\. Grade 6/), 'Brand new pack');
    await user.click(within(dialog).getByRole('button', { name: 'Create pack' }));

    await waitFor(() => expect(create).toHaveBeenCalledWith('Brand new pack'));
  });

  it('publishing an owned draft pack calls packsApi.publish with its id', async () => {
    const { user } = await renderScreen([pack({ id: 'pack-1', status: 'draft' })]);
    publish.mockResolvedValue(pack({ id: 'pack-1', status: 'published' }));

    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(publish).toHaveBeenCalledWith('pack-1'));
  });

  it('shows the API error message in a banner when archiving is rejected', async () => {
    const { user } = await renderScreen([pack({ id: 'pack-1', classCount: 3 })]);
    archive.mockRejectedValue(new Error('Cannot archive a pack used by 3 classes.'));

    await user.click(screen.getByRole('button', { name: 'Archive' }));

    expect(
      await screen.findByText('Cannot archive a pack used by 3 classes.'),
    ).toBeInTheDocument();
  });
});

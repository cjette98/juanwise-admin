import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ApiClass, ApiPack } from '@/shared/api';

const mine = vi.fn();
const assignPack = vi.fn();
const clearPack = vi.fn();
const list = vi.fn();

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  classesApi: {
    mine: (...args: unknown[]) => mine(...args),
    assignPack: (...args: unknown[]) => assignPack(...args),
    clearPack: (...args: unknown[]) => clearPack(...args),
  },
  packsApi: {
    list: (...args: unknown[]) => list(...args),
  },
  errorMessage: (err: unknown, fallback = 'error') =>
    err instanceof Error ? err.message : fallback,
}));

const { default: MyClassesScreen } = await import('./my-classes-screen');

const klass = (over: Partial<ApiClass> = {}): ApiClass => ({
  id: 'class-1',
  code: 'ABC123',
  name: 'Grade 6 - Mabini',
  teacherId: 'teacher-1',
  gradeLevel: '6',
  section: 'Mabini',
  assignment: null,
  packId: null,
  packBinding: null,
  packVersion: null,
  memberCount: 20,
  archived: false,
  createdAt: null,
  updatedAt: null,
  ...over,
});

const pack = (over: Partial<ApiPack> = {}): ApiPack => ({
  id: 'pack-1',
  name: 'Grade 6 – Q1',
  ownerUid: 'teacher-1',
  origin: 'teacher',
  forkedFrom: null,
  status: 'published',
  version: 1,
  publishedAt: null,
  showMiniLesson: true,
  classCount: 0,
  createdAt: null,
  updatedAt: null,
  ...over,
});

const renderScreen = async ({
  classes = [klass()],
  packs = [pack()],
}: { classes?: ApiClass[]; packs?: ApiPack[] } = {}) => {
  mine.mockResolvedValue(classes);
  list.mockResolvedValue(packs);
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <MyClassesScreen />
    </MemoryRouter>,
  );
  await screen.findByText(classes[0]?.name ?? 'No classes yet');
  return { user };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('my classes', () => {
  it("renders the teacher's classes with their pack names", async () => {
    await renderScreen({
      classes: [
        klass({
          id: 'class-1',
          name: 'Grade 6 - Mabini',
          packId: 'pack-1',
          packBinding: 'linked',
          memberCount: 25,
        }),
        klass({ id: 'class-2', name: 'Grade 6 - Rizal', packId: null, memberCount: 30 }),
      ],
      packs: [pack({ id: 'pack-1', name: 'Grade 6 – Q1' })],
    });

    expect(screen.getByText('Grade 6 - Mabini')).toBeInTheDocument();
    expect(screen.getByText('Grade 6 - Rizal')).toBeInTheDocument();
    expect(screen.getByText('Grade 6 – Q1')).toBeInTheDocument();
    expect(screen.getByText('No pack assigned — playing the starter set')).toBeInTheDocument();
    expect(mine).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('choosing "Share it" calls classesApi.assignPack with mode: link', async () => {
    const { user } = await renderScreen({
      classes: [klass({ id: 'class-1', name: 'Grade 6 - Mabini', packId: null })],
      packs: [pack({ id: 'pack-1', name: 'Grade 6 – Q1' })],
    });
    assignPack.mockResolvedValue(klass({ id: 'class-1', packId: 'pack-1', packBinding: 'linked' }));

    await user.click(screen.getByRole('button', { name: 'Assign a pack' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Content pack'), 'pack-1');
    await user.click(within(dialog).getByRole('button', { name: 'Share it' }));

    await waitFor(() =>
      expect(assignPack).toHaveBeenCalledWith('class-1', { packId: 'pack-1', mode: 'link' }),
    );
  });

  it('choosing "Make a copy" calls classesApi.assignPack with mode: copy', async () => {
    const { user } = await renderScreen({
      classes: [klass({ id: 'class-1', name: 'Grade 6 - Mabini', packId: null })],
      packs: [pack({ id: 'pack-1', name: 'Grade 6 – Q1' })],
    });
    assignPack.mockResolvedValue(klass({ id: 'class-1', packId: 'pack-1', packBinding: 'copied' }));

    await user.click(screen.getByRole('button', { name: 'Assign a pack' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Content pack'), 'pack-1');
    await user.click(within(dialog).getByRole('button', { name: 'Make a copy' }));

    await waitFor(() =>
      expect(assignPack).toHaveBeenCalledWith('class-1', { packId: 'pack-1', mode: 'copy' }),
    );
  });

  it('clearing a pack calls classesApi.clearPack', async () => {
    const { user } = await renderScreen({
      classes: [klass({ id: 'class-1', name: 'Grade 6 - Mabini', packId: 'pack-1', packBinding: 'linked' })],
      packs: [pack({ id: 'pack-1', name: 'Grade 6 – Q1' })],
    });
    clearPack.mockResolvedValue(klass({ id: 'class-1', packId: null, packBinding: null }));

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(clearPack).toHaveBeenCalledWith('class-1'));
  });
});

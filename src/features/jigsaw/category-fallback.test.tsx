import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ApiCategory } from '@/shared/api';

const updateCategory = vi.fn();
const upload = vi.fn();

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  contentApi: { updateCategory: (...args: unknown[]) => updateCategory(...args) },
  mediaApi: { upload: (...args: unknown[]) => upload(...args) },
}));

const { CategoryFallback } = await import('./jigsaw-screen');

const category = (over: Partial<ApiCategory> = {}): ApiCategory => ({
  key: 'history',
  label: 'History',
  color: null,
  imageUrl: null,
  context_en: null,
  context_tl: 'Tagalog na aralin',
  definition_en: null,
  definition_tl: null,
  jigsaws: [],
  jigsawSlots: {},
  jigsawPieces: {},
  updatedBy: null,
  updatedAt: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  updateCategory.mockResolvedValue(category());
});

describe('category mini-lesson', () => {
  it('saves the English mini-lesson alongside the Tagalog one', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CategoryFallback packId="pack-1" category={category()} onSaved={onSaved} />);

    await user.type(screen.getByLabelText('Mini-lesson — English'), 'The Philippines declared independence in 1898.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateCategory).toHaveBeenCalledWith('pack-1', 'history', {
        context_en: 'The Philippines declared independence in 1898.',
        context_tl: 'Tagalog na aralin',
      }),
    );
    expect(upload).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it('can drop an uploaded picture back to the built-in one', async () => {
    const user = userEvent.setup();
    render(
      <CategoryFallback
        packId="pack-1"
        category={category({ imageUrl: 'https://example.com/a.jpg' })}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Use the built-in image' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateCategory).toHaveBeenCalledWith('pack-1', 'history', {
        context_en: null,
        context_tl: 'Tagalog na aralin',
        imageUrl: null,
      }),
    );
  });

  it('opens the square cropper for a picked picture', async () => {
    const user = userEvent.setup();
    render(<CategoryFallback packId="pack-1" category={category()} onSaved={vi.fn()} />);
    // jsdom has no object URLs; the cropper only needs a string.
    URL.createObjectURL = vi.fn(() => 'blob:picked');
    URL.revokeObjectURL = vi.fn();

    await user.upload(
      screen.getByLabelText('Category picture file'),
      new File(['x'], 'rizal.png', { type: 'image/png' }),
    );

    expect(screen.getByText('Choose the square')).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ApiQuestion } from '@/shared/api';

const upsertQuestion = vi.fn().mockResolvedValue(undefined);
const revertQuestion = vi.fn().mockResolvedValue(undefined);
const questions = vi.fn();

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  contentApi: {
    questions: (...args: unknown[]) => questions(...args),
    upsertQuestion: (...args: unknown[]) => upsertQuestion(...args),
    revertQuestion: (...args: unknown[]) => revertQuestion(...args),
  },
  errorMessage: (_err: unknown, fallback = 'error') => fallback,
}));

const { default: QuizScreen } = await import('./quiz-screen');

const question = (over: Partial<ApiQuestion> = {}): ApiQuestion => ({
  id: 'history_1_1',
  category: 'history',
  level: 1,
  activityNum: 1,
  type: 'multiple-choice',
  question: 'Sino ang nagtatag ng Katipunan?',
  hint: 'Itinatag noong 1892.',
  explanation: 'Si Andrés Bonifacio.',
  miniLesson: null,
  choices: ['Andrés Bonifacio', 'José Rizal'],
  correctAnswer: 'Andrés Bonifacio',
  answerPool: null,
  requiredAnswers: null,
  acceptedAnswers: null,
  isOverride: true,
  updatedBy: null,
  updatedAt: null,
  ...over,
});

const renderScreen = async (q: ApiQuestion = question()) => {
  questions.mockResolvedValue([q]);
  const user = userEvent.setup();
  render(<QuizScreen />);
  await screen.findByRole('radio', { name: /Multiple choice/ });
  return { user };
};

const typeRadio = (name: RegExp) => screen.getByRole('radio', { name });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('quiz type cards', () => {
  it('renders one radio per type with the selected one checked', async () => {
    await renderScreen();
    expect(typeRadio(/Multiple choice/)).toBeChecked();
    expect(typeRadio(/Enumeration/)).not.toBeChecked();
    expect(typeRadio(/Identification/)).not.toBeChecked();
  });

  it('describes each type on its card', async () => {
    await renderScreen();
    expect(screen.getByText('Students choose one correct answer.')).toBeInTheDocument();
    expect(screen.getByText('Students supply several answers.')).toBeInTheDocument();
    expect(screen.getByText('Students type one answer.')).toBeInTheDocument();
  });

  it('numbers the three editing steps', async () => {
    await renderScreen();
    expect(screen.getByText('1. Choose question type')).toBeInTheDocument();
    expect(screen.getByText('2. Write the question')).toBeInTheDocument();
    expect(screen.getByText('3. Configure the answer')).toBeInTheDocument();
  });

  it('switches without asking when the answer section is empty', async () => {
    const { user } = await renderScreen(
      question({ type: 'multiple-choice', choices: null, correctAnswer: null }),
    );
    await user.click(typeRadio(/Identification/));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(typeRadio(/Identification/)).toBeChecked();
  });
});

describe('confirming a destructive type change', () => {
  it('asks before discarding answers, naming what is lost', async () => {
    const { user } = await renderScreen();
    await user.click(typeRadio(/Identification/));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Change to Identification?')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Your question, hint, explanation, and mini-lesson will stay.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/2 choices and the answer you marked correct/)).toBeInTheDocument();
  });

  it('cancel leaves every field exactly as it was', async () => {
    const { user } = await renderScreen();
    await user.click(typeRadio(/Identification/));
    await user.click(await screen.findByRole('button', { name: 'Keep Multiple choice' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(typeRadio(/Multiple choice/)).toBeChecked();
    expect(screen.getByDisplayValue('Andrés Bonifacio')).toBeInTheDocument();
    expect(screen.getByDisplayValue('José Rizal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sino ang nagtatag ng Katipunan?')).toBeInTheDocument();
  });

  it('confirm keeps the common fields and clears the answers', async () => {
    const { user } = await renderScreen();
    await user.click(typeRadio(/Identification/));
    await user.click(await screen.findByRole('button', { name: 'Change and clear answers' }));

    await waitFor(() => expect(typeRadio(/Identification/)).toBeChecked());
    // Question, hint and explanation survive.
    expect(screen.getByDisplayValue('Sino ang nagtatag ng Katipunan?')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Itinatag noong 1892.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Si Andrés Bonifacio.')).toBeInTheDocument();
    // The multiple-choice answers do not.
    expect(screen.queryByDisplayValue('José Rizal')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Andrés Bonifacio')).not.toBeInTheDocument();
  });
});

describe('identification answer fields', () => {
  const identification = question({
    type: 'identification',
    choices: null,
    correctAnswer: 'Andrés Bonifacio',
    acceptedAnswers: ['Andres Bonifacio'],
  });

  it('shows the primary answer, its alternatives and the matching rule', async () => {
    await renderScreen(identification);
    expect(screen.getByDisplayValue('Andrés Bonifacio')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Andres Bonifacio')).toBeInTheDocument();
    expect(screen.getByText('Capitalization and extra spaces are ignored.')).toBeInTheDocument();
  });

  it('adds and removes alternative rows', async () => {
    const { user } = await renderScreen(identification);
    await user.click(screen.getByRole('button', { name: '+ Add accepted answer' }));
    expect(screen.getAllByPlaceholderText('Andres Bonifacio')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Remove accepted answer 1' }));
    await waitFor(() =>
      expect(screen.getAllByPlaceholderText('Andres Bonifacio')).toHaveLength(1),
    );
  });

  it('sends only the identification fields, dropping blank rows', async () => {
    const { user } = await renderScreen(identification);
    await user.click(screen.getByRole('button', { name: '+ Add accepted answer' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(upsertQuestion).toHaveBeenCalledTimes(1));
    expect(upsertQuestion).toHaveBeenCalledWith('history', 1, 1, {
      type: 'identification',
      question: 'Sino ang nagtatag ng Katipunan?',
      hint: 'Itinatag noong 1892.',
      explanation: 'Si Andrés Bonifacio.',
      miniLesson: null,
      correctAnswer: 'Andrés Bonifacio',
      acceptedAnswers: ['Andres Bonifacio'],
    });
  });

  it('keeps the draft and does not call the API when validation fails', async () => {
    const { user } = await renderScreen(identification);
    await user.clear(screen.getByDisplayValue('Andrés Bonifacio'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Write the correct answer.')).toBeInTheDocument();
    expect(upsertQuestion).not.toHaveBeenCalled();
    // The alternative the admin typed is still there to fix, not discarded.
    expect(screen.getByDisplayValue('Andres Bonifacio')).toBeInTheDocument();
  });
});

describe('mini-lesson field', () => {
  const lesson = 'Ang Katipunan ay lihim na samahang itinatag noong 1892 sa Tondo.';

  it('shows the stored mini-lesson in an editable field', async () => {
    await renderScreen(question({ miniLesson: lesson }));
    expect(screen.getByLabelText(/^Mini-lesson/)).toHaveValue(lesson);
  });

  it('sends what the admin typed into the mini-lesson', async () => {
    const { user } = await renderScreen();
    await user.type(screen.getByLabelText(/^Mini-lesson/), lesson);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(upsertQuestion).toHaveBeenCalledTimes(1));
    expect(upsertQuestion).toHaveBeenCalledWith(
      'history',
      1,
      1,
      expect.objectContaining({ miniLesson: lesson }),
    );
  });

  it('survives a question type change', async () => {
    const { user } = await renderScreen(
      question({ miniLesson: lesson, choices: null, correctAnswer: null }),
    );
    await user.click(typeRadio(/Identification/));
    expect(screen.getByLabelText(/^Mini-lesson/)).toHaveValue(lesson);
  });
});

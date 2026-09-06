import type { ApiQuestion, ApiQuestionType, UpsertQuestionRequest } from '@/shared/api';

/**
 * The rules the quiz editor works by, kept out of the screen so they can be
 * tested without rendering anything.
 *
 * They deliberately mirror juanwise-be `content/content.schema.ts`: a save that
 * the backend would reject should be caught here first, and the normalization
 * used for duplicate answers has to be the same on both sides or the admin's
 * uniqueness warning would mean something different from the game's grading.
 */

export const MIN_CHOICES = 2;
export const MAX_CHOICES = 8;
export const MIN_ENUMERATION_POOL = 10;
export const MAX_ACCEPTED_ANSWERS = 20;
export const MAX_ANSWER_LENGTH = 200;

/** The editor's working copy — the API shape with all three variants flattened. */
export interface QuizDraft {
  type: ApiQuestionType;
  question: string;
  hint: string;
  explanation: string;
  /** multiple-choice */
  choices: string[];
  /** multiple-choice and identification both store their answer here. */
  correctAnswer: string;
  /** enumeration */
  answerPool: string[];
  /** enumeration */
  requiredAnswers: number;
  /** identification — alternatives only, never the primary answer again. */
  acceptedAnswers: string[];
}

/** Trim, collapse repeated internal whitespace, lowercase — as the backend does. */
const normalizeAnswer = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

const cleaned = (values: string[]) => values.map((v) => v.trim()).filter(Boolean);

/** The answer fields a fresh draft of each type starts from. */
const emptyAnswerFields = () => ({
  choices: ['', ''],
  correctAnswer: '',
  answerPool: [],
  requiredAnswers: 3,
  acceptedAnswers: [],
});

export function toQuizDraft(q: ApiQuestion): QuizDraft {
  return {
    ...emptyAnswerFields(),
    type: q.type,
    question: q.question ?? '',
    hint: q.hint ?? '',
    explanation: q.explanation ?? '',
    choices: q.choices?.length ? [...q.choices] : ['', ''],
    correctAnswer: q.correctAnswer ?? '',
    answerPool: q.answerPool ? [...q.answerPool] : [],
    requiredAnswers: q.requiredAnswers ?? 3,
    // Null on any question stored before identification existed.
    acceptedAnswers: q.acceptedAnswers ? [...q.acceptedAnswers] : [],
  };
}

/** Mirrors juanwise-be `content.schema.ts` so a save is not spent on a 422. */
export function validateQuizDraft(draft: QuizDraft): string | null {
  if (!draft.question.trim()) return 'Write the question first.';

  if (draft.type === 'multiple-choice') {
    const choices = cleaned(draft.choices);
    if (choices.length < MIN_CHOICES) return `Give at least ${MIN_CHOICES} choices.`;
    if (choices.length > MAX_CHOICES) return `Give at most ${MAX_CHOICES} choices.`;
    if (new Set(choices).size !== choices.length) return 'Two choices are identical.';
    if (!draft.correctAnswer.trim()) return 'Mark which choice is the correct answer.';
    if (!choices.includes(draft.correctAnswer.trim()))
      return 'The correct answer must be one of the choices.';
    return null;
  }

  if (draft.type === 'identification') {
    const primary = draft.correctAnswer.trim();
    if (!primary) return 'Write the correct answer.';
    if (primary.length > MAX_ANSWER_LENGTH)
      return `An answer can be at most ${MAX_ANSWER_LENGTH} characters.`;

    const alternatives = cleaned(draft.acceptedAnswers);
    if (alternatives.length > MAX_ACCEPTED_ANSWERS)
      return `Give at most ${MAX_ACCEPTED_ANSWERS} other accepted answers.`;
    if (alternatives.some((a) => a.length > MAX_ANSWER_LENGTH))
      return `An accepted answer can be at most ${MAX_ANSWER_LENGTH} characters.`;

    // Capitalization and spacing are ignored when grading, so two answers that
    // differ only by those are the same answer listed twice.
    const normalized = [primary, ...alternatives].map(normalizeAnswer);
    if (new Set(normalized).size !== normalized.length)
      return 'The same answer is listed twice. Capitalization and extra spaces are ignored.';
    return null;
  }

  const pool = cleaned(draft.answerPool);
  if (pool.length < MIN_ENUMERATION_POOL)
    return `Enumeration needs an answer pool of at least ${MIN_ENUMERATION_POOL} entries.`;
  if (draft.requiredAnswers < 1) return 'Required answers must be at least 1.';
  if (draft.requiredAnswers > pool.length)
    return 'Required answers cannot exceed the size of the answer pool.';
  return null;
}

/** Sends only the answer fields the chosen type owns. */
export function toQuestionRequest(draft: QuizDraft): UpsertQuestionRequest {
  const common = {
    question: draft.question.trim(),
    hint: draft.hint.trim() || null,
    explanation: draft.explanation.trim() || null,
  };

  if (draft.type === 'enumeration') {
    return {
      ...common,
      type: 'enumeration',
      answerPool: cleaned(draft.answerPool),
      requiredAnswers: draft.requiredAnswers,
    };
  }

  if (draft.type === 'identification') {
    return {
      ...common,
      type: 'identification',
      correctAnswer: draft.correctAnswer.trim(),
      // Empty rows stay visible while editing but are never sent — the backend
      // rejects a blank alternative.
      acceptedAnswers: cleaned(draft.acceptedAnswers),
    };
  }

  return {
    ...common,
    type: 'multiple-choice',
    choices: cleaned(draft.choices),
    correctAnswer: draft.correctAnswer.trim(),
  };
}

/**
 * Whether the answer section holds anything a type change would destroy.
 *
 * Only the fields the current type owns are inspected, so leftovers from a
 * previous type never trigger a warning, and the blank rows the editor shows as
 * placeholders do not count as content.
 */
export function hasAnswerContent(draft: QuizDraft): boolean {
  if (draft.type === 'multiple-choice')
    return cleaned(draft.choices).length > 0 || draft.correctAnswer.trim() !== '';
  if (draft.type === 'identification')
    return draft.correctAnswer.trim() !== '' || cleaned(draft.acceptedAnswers).length > 0;
  return cleaned(draft.answerPool).length > 0;
}

/**
 * Changes the type, keeping Question, Hint and Explanation and resetting every
 * answer field.
 *
 * All of them are reset, not just the ones the old type owned — `correctAnswer`
 * is shared between multiple-choice and identification, so carrying it across
 * would silently turn a discarded choice into the new primary answer.
 */
export function switchQuestionType(draft: QuizDraft, nextType: ApiQuestionType): QuizDraft {
  return {
    ...emptyAnswerFields(),
    type: nextType,
    question: draft.question,
    hint: draft.hint,
    explanation: draft.explanation,
  };
}

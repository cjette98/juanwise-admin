import { describe, expect, it } from 'vitest';
import type { ApiQuestion } from '@/shared/api';
import {
  hasAnswerContent,
  switchQuestionType,
  toQuizDraft,
  toQuestionRequest,
  validateQuizDraft,
  type QuizDraft,
} from './quiz-draft';

const draft = (over: Partial<QuizDraft> = {}): QuizDraft => ({
  type: 'multiple-choice',
  question: 'Who founded the Katipunan?',
  hint: '',
  explanation: '',
  miniLesson: '',
  miniLessonImageUrl: '',
  choices: ['', ''],
  correctAnswer: '',
  answerPool: [],
  requiredAnswers: 3,
  acceptedAnswers: [],
  ...over,
});

const multipleChoiceDraft = draft({
  hint: 'Founded in 1892.',
  explanation: 'Bonifacio founded it.',
  choices: ['Andrés Bonifacio', 'José Rizal'],
  correctAnswer: 'Andrés Bonifacio',
});

const identificationDraft = draft({
  type: 'identification',
  correctAnswer: 'Andrés Bonifacio',
  acceptedAnswers: ['Andres Bonifacio', 'Bonifacio'],
});

const enumerationDraft = draft({
  type: 'enumeration',
  answerPool: Array.from({ length: 10 }, (_, i) => `Answer ${i}`),
  requiredAnswers: 3,
});

describe('toQuestionRequest', () => {
  it('serializes only identification answer fields', () => {
    expect(toQuestionRequest(identificationDraft)).toEqual({
      type: 'identification',
      question: 'Who founded the Katipunan?',
      hint: null,
      explanation: null,
      miniLesson: null,
      miniLessonImageUrl: null,
      correctAnswer: 'Andrés Bonifacio',
      acceptedAnswers: ['Andres Bonifacio', 'Bonifacio'],
    });
  });

  it('drops blank alternatives left behind while editing', () => {
    const request = toQuestionRequest(
      draft({ type: 'identification', correctAnswer: 'A', acceptedAnswers: ['', '  ', 'B'] }),
    );
    expect(request).toMatchObject({ acceptedAnswers: ['B'] });
  });

  it('serializes only multiple-choice answer fields', () => {
    expect(toQuestionRequest(multipleChoiceDraft)).toEqual({
      type: 'multiple-choice',
      question: 'Who founded the Katipunan?',
      hint: 'Founded in 1892.',
      explanation: 'Bonifacio founded it.',
      miniLesson: null,
      miniLessonImageUrl: null,
      choices: ['Andrés Bonifacio', 'José Rizal'],
      correctAnswer: 'Andrés Bonifacio',
    });
  });

  it('serializes only enumeration answer fields', () => {
    expect(toQuestionRequest(enumerationDraft)).toEqual({
      type: 'enumeration',
      question: 'Who founded the Katipunan?',
      hint: null,
      explanation: null,
      miniLesson: null,
      miniLessonImageUrl: null,
      answerPool: enumerationDraft.answerPool,
      requiredAnswers: 3,
    });
  });
});

describe('validateQuizDraft', () => {
  it('accepts identification with and without alternatives', () => {
    expect(validateQuizDraft(identificationDraft)).toBeNull();
    expect(validateQuizDraft(draft({ type: 'identification', correctAnswer: 'A' }))).toBeNull();
  });

  it('rejects an empty primary answer', () => {
    expect(validateQuizDraft(draft({ type: 'identification', correctAnswer: '   ' }))).toMatch(
      /correct answer/i,
    );
  });

  it('rejects alternatives that duplicate after normalization', () => {
    expect(
      validateQuizDraft(
        draft({
          type: 'identification',
          correctAnswer: 'Andrés Bonifacio',
          acceptedAnswers: ['  ANDRÉS   BONIFACIO  '],
        }),
      ),
    ).toMatch(/listed twice|unique|duplicate/i);

    expect(
      validateQuizDraft(
        draft({ type: 'identification', correctAnswer: 'A', acceptedAnswers: ['B', 'b'] }),
      ),
    ).toMatch(/listed twice|unique|duplicate/i);
  });

  it('rejects more than 20 alternatives', () => {
    expect(
      validateQuizDraft(
        draft({
          type: 'identification',
          correctAnswer: 'A',
          acceptedAnswers: Array.from({ length: 21 }, (_, i) => `alt ${i}`),
        }),
      ),
    ).toMatch(/20/);
  });

  it('rejects an alternative over 200 characters', () => {
    expect(
      validateQuizDraft(
        draft({ type: 'identification', correctAnswer: 'A', acceptedAnswers: ['x'.repeat(201)] }),
      ),
    ).toMatch(/200/);
  });

  it('still enforces the existing multiple-choice and enumeration rules', () => {
    expect(validateQuizDraft(multipleChoiceDraft)).toBeNull();
    expect(validateQuizDraft(enumerationDraft)).toBeNull();
    expect(validateQuizDraft(draft({ type: 'enumeration', answerPool: ['a'] }))).toMatch(/10/);
    expect(validateQuizDraft(draft({ question: '  ' }))).toMatch(/question/i);
  });
});

describe('hasAnswerContent', () => {
  it('only inspects the fields the current type owns', () => {
    // Enumeration data left in a multiple-choice draft is not this type's content.
    expect(hasAnswerContent(draft({ answerPool: ['a', 'b'] }))).toBe(false);
    expect(hasAnswerContent(draft({ type: 'enumeration', choices: ['a', 'b'] }))).toBe(false);
    expect(hasAnswerContent(draft({ type: 'identification', choices: ['a', 'b'] }))).toBe(false);
  });

  it('does not count blank multiple-choice placeholder rows', () => {
    expect(hasAnswerContent(draft())).toBe(false);
    expect(hasAnswerContent(draft({ choices: ['', '', ''] }))).toBe(false);
    expect(hasAnswerContent(draft({ choices: ['Andrés', ''] }))).toBe(true);
  });

  it('detects real content for each type', () => {
    expect(hasAnswerContent(multipleChoiceDraft)).toBe(true);
    expect(hasAnswerContent(enumerationDraft)).toBe(true);
    expect(hasAnswerContent(identificationDraft)).toBe(true);
    expect(hasAnswerContent(draft({ type: 'identification', correctAnswer: 'A' }))).toBe(true);
    expect(hasAnswerContent(draft({ type: 'identification', acceptedAnswers: ['', ' '] }))).toBe(false);
    expect(hasAnswerContent(draft({ type: 'enumeration', answerPool: ['', ' '] }))).toBe(false);
  });
});

describe('switchQuestionType', () => {
  it('preserves common fields and clears answers when switching type', () => {
    const next = switchQuestionType(multipleChoiceDraft, 'enumeration');
    expect(next).toMatchObject({
      type: 'enumeration',
      question: multipleChoiceDraft.question,
      hint: multipleChoiceDraft.hint,
      explanation: multipleChoiceDraft.explanation,
      choices: ['', ''],
      correctAnswer: '',
      answerPool: [],
      requiredAnswers: 3,
      acceptedAnswers: [],
    });
  });

  it('clears the shared correctAnswer when moving between the types that use it', () => {
    // Both multiple-choice and identification store an answer there, so a stale
    // choice must not survive as an identification answer.
    const next = switchQuestionType(multipleChoiceDraft, 'identification');
    expect(next.correctAnswer).toBe('');
    expect(next.acceptedAnswers).toEqual([]);
    expect(next.question).toBe(multipleChoiceDraft.question);
  });

  it('does not mutate the draft it was given', () => {
    const before = structuredClone(identificationDraft);
    switchQuestionType(identificationDraft, 'multiple-choice');
    expect(identificationDraft).toEqual(before);
  });
});

describe('toQuizDraft', () => {
  const api = (over: Partial<ApiQuestion>): ApiQuestion => ({
    id: 'history_1_1',
    category: 'history',
    level: 1,
    activityNum: 1,
    type: 'identification',
    question: 'Q',
    hint: null,
    explanation: null,
    miniLesson: null,
    miniLessonImageUrl: null,
    choices: null,
    correctAnswer: 'Andrés Bonifacio',
    answerPool: null,
    requiredAnswers: null,
    acceptedAnswers: ['Bonifacio'],
    isOverride: true,
    updatedBy: null,
    updatedAt: null,
    ...over,
  });

  it('reads identification answers back out of an API question', () => {
    expect(toQuizDraft(api({}))).toMatchObject({
      type: 'identification',
      correctAnswer: 'Andrés Bonifacio',
      acceptedAnswers: ['Bonifacio'],
    });
  });

  it('treats a response with no acceptedAnswers as having none', () => {
    expect(toQuizDraft(api({ acceptedAnswers: null })).acceptedAnswers).toEqual([]);
  });
});

describe('mini-lesson', () => {
  const lesson = 'Ang Katipunan ay lihim na samahang itinatag ni Andres Bonifacio noong 1892.';

  it('loads the stored mini-lesson into the draft', () => {
    const question = { type: 'multiple-choice', question: 'Q', miniLesson: lesson } as ApiQuestion;
    expect(toQuizDraft(question).miniLesson).toBe(lesson);
  });

  it('reads a question stored before mini-lessons existed as an empty field', () => {
    const question = { type: 'multiple-choice', question: 'Q', miniLesson: null } as ApiQuestion;
    expect(toQuizDraft(question).miniLesson).toBe('');
  });

  it.each([
    ['multiple-choice', multipleChoiceDraft],
    ['enumeration', enumerationDraft],
    ['identification', identificationDraft],
  ])('sends the mini-lesson on a %s question', (_label, base) => {
    expect(toQuestionRequest({ ...base, miniLesson: lesson })).toMatchObject({
      miniLesson: lesson,
    });
  });

  it('sends null rather than an empty string when there is no mini-lesson', () => {
    expect(toQuestionRequest({ ...multipleChoiceDraft, miniLesson: '   ' })).toMatchObject({
      miniLesson: null,
    });
  });

  it('keeps the mini-lesson when the question type changes', () => {
    // It teaches the topic, so it survives the switch exactly as the question,
    // hint and explanation do — only the answer fields are reset.
    const switched = switchQuestionType(
      { ...multipleChoiceDraft, miniLesson: lesson },
      'identification',
    );
    expect(switched.miniLesson).toBe(lesson);
  });

  it('is not answer content, so a mini-lesson alone does not warn on type change', () => {
    expect(hasAnswerContent(draft({ miniLesson: lesson }))).toBe(false);
  });
});

describe('mini-lesson image', () => {
  const url = 'https://storage.googleapis.com/juanwise/question-images/history/abc.jpg';

  it('reads the stored image into the draft', () => {
    const question = {
      type: 'multiple-choice',
      question: 'Q',
      miniLessonImageUrl: url,
    } as ApiQuestion;
    expect(toQuizDraft(question).miniLessonImageUrl).toBe(url);
  });

  it('reads a question authored before the field existed as having no image', () => {
    const question = {
      type: 'multiple-choice',
      question: 'Q',
      miniLessonImageUrl: null,
    } as ApiQuestion;
    expect(toQuizDraft(question).miniLessonImageUrl).toBe('');
  });

  it('sends the image on every save, so a full overwrite cannot clear it', () => {
    expect(
      toQuestionRequest({ ...multipleChoiceDraft, miniLessonImageUrl: url }),
    ).toMatchObject({ miniLessonImageUrl: url });
  });

  it('sends null rather than an empty string when there is no image', () => {
    expect(
      toQuestionRequest({ ...multipleChoiceDraft, miniLessonImageUrl: '   ' }),
    ).toMatchObject({ miniLessonImageUrl: null });
  });

  it('survives a type change, the way the mini-lesson text does', () => {
    const switched = switchQuestionType(
      { ...multipleChoiceDraft, miniLessonImageUrl: url },
      'enumeration',
    );
    expect(switched.miniLessonImageUrl).toBe(url);
  });

  it('does not count as answer content a type change would destroy', () => {
    expect(hasAnswerContent(draft({ miniLessonImageUrl: url }))).toBe(false);
  });
});

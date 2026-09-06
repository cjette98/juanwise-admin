import { useEffect, useMemo, useRef, useState } from 'react';
import {
  contentApi,
  errorMessage,
  mediaApi,
  type ApiCategoryKey,
  type ApiQuestion,
  type ApiQuestionType,
} from '@/shared/api';
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  Loading,
  Select,
  Textarea,
} from '@/shared/components/ui';
import { useAsync } from '@/shared/lib/use-async';
import { categoryColor, categoryMeta } from '@/shared/theme/colors';
import {
  MAX_ACCEPTED_ANSWERS,
  MAX_CHOICES,
  MIN_CHOICES,
  hasAnswerContent,
  switchQuestionType,
  toQuestionRequest,
  toQuizDraft,
  validateQuizDraft,
  type QuizDraft,
} from './quiz-draft';

/**
 * The quiz authoring screen.
 *
 * The grid is fixed at 5 levels × 6 activities per category (juanwise-be
 * `shared/constants.ts`), and `GET /content/questions` returns every slot in it
 * — an unauthored one comes back with the seeded default and
 * `isOverride: false`. So this screen never has to invent an empty slot or
 * track which ones exist; it renders what the API returns and marks the
 * difference.
 */
const LEVELS = [1, 2, 3, 4, 5];
const ACTIVITIES = [1, 2, 3, 4, 5, 6];

const QUESTION_TYPES: { key: ApiQuestionType; label: string; description: string }[] = [
  { key: 'multiple-choice', label: 'Multiple choice', description: 'Students choose one correct answer.' },
  { key: 'enumeration', label: 'Enumeration', description: 'Students supply several answers.' },
  { key: 'identification', label: 'Identification', description: 'Students type one answer.' },
];

const TYPE_LABELS: Record<ApiQuestionType, string> = {
  'multiple-choice': 'Multiple choice',
  enumeration: 'Enumeration',
  identification: 'Identification',
};

const ANSWER_HINTS: Record<ApiQuestionType, string> = {
  'multiple-choice': 'Click a circle to mark the correct answer. Two to eight choices.',
  enumeration: 'The game shows a subset of the pool and asks for the required number of answers.',
  identification: 'Capitalization and extra spaces are ignored.',
};

const replaceAt = (values: string[], index: number, value: string) =>
  values.map((current, i) => (i === index ? value : current));

/**
 * Names the answer content a type change would discard, so the warning says
 * what is actually at stake rather than "your answers".
 */
function answerContentSummary(draft: QuizDraft): string {
  if (draft.type === 'multiple-choice') {
    const choices = draft.choices.filter((c) => c.trim()).length;
    const marked = draft.correctAnswer.trim() ? ' and the answer you marked correct' : '';
    return `${choices} ${choices === 1 ? 'choice' : 'choices'}${marked}`;
  }

  if (draft.type === 'identification') {
    const alternatives = draft.acceptedAnswers.filter((a) => a.trim()).length;
    const primary = draft.correctAnswer.trim() ? 'the correct answer' : '';
    const extra = alternatives
      ? `${alternatives} other accepted ${alternatives === 1 ? 'answer' : 'answers'}`
      : '';
    return [primary, extra].filter(Boolean).join(' and ');
  }

  const pool = draft.answerPool.filter((a) => a.trim()).length;
  return `an answer pool of ${pool} ${pool === 1 ? 'entry' : 'entries'}`;
}

export default function QuizScreen() {
  const [category, setCategory] = useState<ApiCategoryKey>('history');
  const [level, setLevel] = useState(1);
  const [activityNum, setActivityNum] = useState(1);

  const questions = useAsync(() => contentApi.questions({ category, level }), [category, level]);

  const selected = useMemo(
    () => questions.data?.find((q) => q.activityNum === activityNum) ?? null,
    [questions.data, activityNum],
  );

  return (
    <>
      <Card
        title="Choose an activity"
        hint="Every category has 5 levels of 6 activities. Level 1 is what a new player sees first."
      >
        <div className="grid" style={{ gap: 14 }}>
          <div className="row">
            <Field label="Category">
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as ApiCategoryKey)}
                style={{ width: 220 }}
              >
                {categoryMeta.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Level">
              <Select
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                style={{ width: 120 }}
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    Level {l}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div>
            <div className="field__label" style={{ marginBottom: 8 }}>
              Activity
            </div>
            <div className="row">
              {ACTIVITIES.map((num) => {
                const question = questions.data?.find((q) => q.activityNum === num);
                const authored = question?.isOverride ?? false;
                const active = num === activityNum;
                return (
                  <button
                    key={num}
                    onClick={() => setActivityNum(num)}
                    className="btn btn--secondary"
                    style={{
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 2,
                      minWidth: 118,
                      borderColor: active ? categoryColor(category) : undefined,
                      boxShadow: active ? `0 0 0 2px ${categoryColor(category)}22` : undefined,
                    }}
                  >
                    <span>Activity {num}</span>
                    <span className="table__sub" style={{ fontWeight: 500 }}>
                      {authored ? '✅ Authored' : '○ Default'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {questions.loading ? (
        <Loading label="Loading activities…" />
      ) : questions.error ? (
        <Banner tone="error">{questions.error}</Banner>
      ) : selected ? (
        <QuestionEditor
          key={selected.id}
          question={selected}
          category={category}
          level={level}
          activityNum={activityNum}
          onSaved={questions.reload}
        />
      ) : null}
    </>
  );
}

function QuestionEditor({
  question,
  category,
  level,
  activityNum,
  onSaved,
}: {
  question: ApiQuestion;
  category: ApiCategoryKey;
  level: number;
  activityNum: number;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<QuizDraft>(() => toQuizDraft(question));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<'save' | 'revert' | null>(null);
  // The type the admin picked but has not confirmed losing their answers for.
  const [pendingType, setPendingType] = useState<ApiQuestionType | null>(null);
  const [uploading, setUploading] = useState(false);
  const pictureInput = useRef<HTMLInputElement>(null);
  // The category colour marks the selected card only. Actions stay JuanWise
  // blue, so "which type is this" and "what can I press" read differently.
  const accent = categoryColor(category);

  // A different slot mounts a fresh editor (`key` on the element), but the same
  // slot reloading after a save should pick up what the server stored.
  useEffect(() => {
    setDraft(toQuizDraft(question));
  }, [question]);

  /**
   * The file goes straight to Cloud Storage with a signed URL; only the public
   * URL lands in the draft. Nothing reaches the question until Save, so backing
   * out leaves the published activity untouched.
   */
  const uploadPicture = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await mediaApi.upload(file, 'question-image', { categoryKey: category });
      patch({ miniLessonImageUrl: url });
    } catch (err) {
      setError(errorMessage(err, 'Could not upload the picture.'));
    } finally {
      setUploading(false);
      // Clear the input so re-picking the same file fires `change` again.
      if (pictureInput.current) pictureInput.current.value = '';
    }
  };

  const patch = (next: Partial<QuizDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setSaved(false);
    setError(null);
  };

  /**
   * Switching type clears the previous type's answers, so it only happens
   * silently when there is nothing to lose.
   */
  const requestType = (nextType: ApiQuestionType) => {
    if (nextType === draft.type) return;
    if (hasAnswerContent(draft)) setPendingType(nextType);
    else patch(switchQuestionType(draft, nextType));
  };

  const confirmTypeChange = () => {
    if (pendingType) patch(switchQuestionType(draft, pendingType));
    setPendingType(null);
  };

  const setChoice = (index: number, value: string) => {
    const choices = [...draft.choices];
    const previous = choices[index];
    choices[index] = value;
    // Keep the correct answer pinned to the choice it was marked on, even while
    // that choice is still being typed.
    const correctAnswer = draft.correctAnswer === previous ? value : draft.correctAnswer;
    patch({ choices, correctAnswer });
  };

  const removeChoice = (index: number) => {
    const removed = draft.choices[index];
    patch({
      choices: draft.choices.filter((_, i) => i !== index),
      correctAnswer: draft.correctAnswer === removed ? '' : draft.correctAnswer,
    });
  };

  const save = async () => {
    const problem = validateQuizDraft(draft);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy('save');
    setError(null);
    try {
      await contentApi.upsertQuestion(category, level, activityNum, toQuestionRequest(draft));
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'The activity could not be saved.'));
    } finally {
      setBusy(null);
    }
  };

  const revert = async () => {
    if (!window.confirm('Discard your edits and restore the built-in question for this activity?'))
      return;

    setBusy('revert');
    setError(null);
    try {
      await contentApi.revertQuestion(category, level, activityNum);
      setSaved(false);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'The activity could not be reverted.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card
      title={`Level ${level} · Activity ${activityNum}`}
      hint={
        question.isOverride
          ? `Authored content — last saved ${question.updatedAt ? new Date(question.updatedAt).toLocaleString() : 'recently'}`
          : 'Showing the built-in question. Saving replaces it for every player.'
      }
      actions={
        <>
          {question.isOverride ? <Badge tone="green">Authored</Badge> : <Badge>Default</Badge>}
          {question.isOverride && (
            <Button variant="secondary" small onClick={revert} busy={busy === 'revert'}>
              Revert to default
            </Button>
          )}
          <Button onClick={save} busy={busy === 'save'}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid" style={{ gap: 16 }}>
        {error && <Banner tone="error">{error}</Banner>}
        {saved && !error && <Banner tone="success">Saved. Every player sees this now.</Banner>}

        <ConfirmDialog
          open={pendingType !== null}
          title={`Change to ${pendingType ? TYPE_LABELS[pendingType] : ''}?`}
          confirmLabel="Change and clear answers"
          cancelLabel={`Keep ${TYPE_LABELS[draft.type]}`}
          danger
          onConfirm={confirmTypeChange}
          onCancel={() => setPendingType(null)}
        >
          <p>Your question, hint, explanation, and mini-lesson will stay.</p>
          <p className="dialog__warning">
            This removes {answerContentSummary(draft)}. Nothing is saved until you choose Save
            changes.
          </p>
        </ConfirmDialog>

        <fieldset className="quiz-types">
          <legend className="quiz-section__legend">1. Choose question type</legend>
          <div className="quiz-types__grid">
            {QUESTION_TYPES.map((option) => {
              const selected = draft.type === option.key;
              return (
                <label
                  key={option.key}
                  className={`quiz-type ${selected ? 'quiz-type--selected' : ''}`}
                  style={selected ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}` } : undefined}
                >
                  <input
                    type="radio"
                    className="quiz-type__radio"
                    name={`question-type-${level}-${activityNum}`}
                    value={option.key}
                    checked={selected}
                    onChange={() => requestType(option.key)}
                  />
                  <span className="quiz-type__name">{option.label}</span>
                  <span className="quiz-type__desc">{option.description}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <section className="quiz-section">
          <h3 className="quiz-section__legend">2. Write the question</h3>
          <Textarea
            value={draft.question}
            onChange={(e) => patch({ question: e.target.value })}
            placeholder="Sino ang itinuturing na pambansang bayani ng Pilipinas?"
            style={{ minHeight: 76 }}
          />
        </section>

        <section className="quiz-section">
          <h3 className="quiz-section__legend">3. Configure the answer</h3>
          <p className="quiz-section__hint">{ANSWER_HINTS[draft.type]}</p>

          {draft.type === 'multiple-choice' && (
            <div className="grid" style={{ gap: 8 }}>
              {draft.choices.map((choice, index) => {
                const isCorrect = choice.trim() !== '' && choice === draft.correctAnswer;
                return (
                  <div className={`choice ${isCorrect ? 'choice--correct' : ''}`} key={index}>
                    <button
                      type="button"
                      className="choice__marker"
                      title="Mark as the correct answer"
                      aria-label={`Mark choice ${index + 1} as correct`}
                      onClick={() => choice.trim() && patch({ correctAnswer: choice })}
                    >
                      {isCorrect ? '✓' : String.fromCharCode(65 + index)}
                    </button>
                    <Input
                      value={choice}
                      onChange={(e) => setChoice(index, e.target.value)}
                      placeholder={`Choice ${String.fromCharCode(65 + index)}`}
                    />
                    <Button
                      variant="ghost"
                      small
                      onClick={() => removeChoice(index)}
                      disabled={draft.choices.length <= MIN_CHOICES}
                      title={
                        draft.choices.length <= MIN_CHOICES
                          ? `A question needs at least ${MIN_CHOICES} choices`
                          : 'Remove this choice'
                      }
                    >
                      ✕
                    </Button>
                  </div>
                );
              })}

              <div>
                <Button
                  variant="secondary"
                  small
                  onClick={() => patch({ choices: [...draft.choices, ''] })}
                  disabled={draft.choices.length >= MAX_CHOICES}
                >
                  + Add choice
                </Button>
              </div>
            </div>
          )}

          {draft.type === 'identification' && (
            <div className="grid" style={{ gap: 14 }}>
              <Field label="Correct answer">
                <Input
                  value={draft.correctAnswer}
                  onChange={(e) => patch({ correctAnswer: e.target.value })}
                  placeholder="Andrés Bonifacio"
                />
              </Field>

              <Field
                label="Other accepted answers"
                hint="Optional. Add a row for each spelling that should also pass."
              >
                <div className="grid" style={{ gap: 8 }}>
                  {draft.acceptedAnswers.map((answer, index) => (
                    <div className="choice" key={index}>
                      <Input
                        value={answer}
                        onChange={(e) => patch({ acceptedAnswers: replaceAt(draft.acceptedAnswers, index, e.target.value) })}
                        placeholder="Andres Bonifacio"
                      />
                      <Button
                        variant="ghost"
                        small
                        onClick={() =>
                          patch({ acceptedAnswers: draft.acceptedAnswers.filter((_, i) => i !== index) })
                        }
                        title="Remove this accepted answer"
                        aria-label={`Remove accepted answer ${index + 1}`}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}

                  <div>
                    <Button
                      variant="secondary"
                      small
                      onClick={() => patch({ acceptedAnswers: [...draft.acceptedAnswers, ''] })}
                      disabled={draft.acceptedAnswers.length >= MAX_ACCEPTED_ANSWERS}
                      title={
                        draft.acceptedAnswers.length >= MAX_ACCEPTED_ANSWERS
                          ? `At most ${MAX_ACCEPTED_ANSWERS} other accepted answers`
                          : undefined
                      }
                    >
                      + Add accepted answer
                    </Button>
                  </div>
                </div>
              </Field>
            </div>
          )}

          {draft.type === 'enumeration' && (
            <div className="grid" style={{ gap: 14 }}>
              <Field
                label="Answer pool"
                hint="One answer per line. At least 10 — the game shows a subset of these."
              >
                <Textarea
                  value={draft.answerPool.join('\n')}
                  onChange={(e) => patch({ answerPool: e.target.value.split('\n') })}
                  placeholder={'Luzon\nVisayas\nMindanao\n…'}
                  style={{ minHeight: 160 }}
                />
              </Field>
              <Field label="Required answers" hint="How many the student must get for a pass.">
                <Input
                  type="number"
                  min={1}
                  value={draft.requiredAnswers}
                  onChange={(e) => patch({ requiredAnswers: Number(e.target.value) })}
                  style={{ width: 120 }}
                />
              </Field>
            </div>
          )}
        </section>

        <div className="grid grid--2">
          <Field label="Hint" hint="Shown when the player asks for help. Optional.">
            <Input
              value={draft.hint}
              onChange={(e) => patch({ hint: e.target.value })}
              placeholder="Isinilang siya sa Calamba, Laguna."
            />
          </Field>

          <Field label="Explanation" hint="Shown after answering. Optional.">
            <Input
              value={draft.explanation}
              onChange={(e) => patch({ explanation: e.target.value })}
              placeholder="Si Dr. Jose Rizal ang pambansang bayani ng Pilipinas."
            />
          </Field>
        </div>

        {/*
          Full width rather than a third column beside Hint and Explanation:
          those are one-liners, this is a paragraph the student reads after the
          activity, so a cramped input would hide most of what was written.
        */}
        <Field
          label="Mini-lesson"
          hint="The longer write-up on the mini-lessons screen. Falls back to the explanation when empty. Optional."
        >
          <Textarea
            rows={6}
            value={draft.miniLesson}
            onChange={(e) => patch({ miniLesson: e.target.value })}
            placeholder="Ang Katipunan ay lihim na samahang itinatag ni Andres Bonifacio noong Hulyo 7, 1892 sa Tondo, Maynila..."
          />
        </Field>

        {/*
          Not wrapped in <Field>, which renders a <label>: a click anywhere
          inside one would reach the hidden file input, so the Remove button
          would re-open the picker on its way to clearing the picture.
        */}
        <div className="field">
          <span className="field__label">Mini-lesson picture</span>
          <input
            ref={pictureInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => void uploadPicture(e.target.files?.[0])}
          />
          {draft.miniLessonImageUrl ? (
            <img
              src={draft.miniLessonImageUrl}
              alt=""
              style={{
                // A square preview rather than a full-width strip: the picture
                // is shown beside the write-up, not as a banner, and a 2000x220
                // letterbox cropped every portrait down to a slice of a face.
                width: '100%', maxWidth: 300, aspectRatio: '1 / 1', objectFit: 'cover',
                borderRadius: 10, border: '1px solid var(--line, #e2e2e2)',
              }}
            />
          ) : (
            <div
              style={{
                // Same box as the preview, so uploading or removing a picture
                // does not shift everything below it.
                width: '100%', maxWidth: 300, aspectRatio: '1 / 1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px 16px', borderRadius: 10, textAlign: 'center',
                border: '1px dashed var(--line, #d9d9d9)', color: 'var(--muted, #767676)',
                fontSize: 13,
              }}
            >
              No picture — the category picture is used instead.
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Button
              type="button"
              variant="secondary"
              small
              busy={uploading}
              disabled={busy !== null}
              onClick={() => pictureInput.current?.click()}
            >
              {draft.miniLessonImageUrl ? 'Replace picture' : 'Upload picture'}
            </Button>
            {draft.miniLessonImageUrl && !uploading && (
              <Button
                type="button"
                variant="ghost"
                small
                disabled={busy !== null}
                onClick={() => patch({ miniLessonImageUrl: '' })}
              >
                Remove
              </Button>
            )}
          </div>
          <span className="field__hint">
            Shown beside the write-up on the mini-lessons screen, after the student passes the
            activity. It is not shown while the question is being answered, so it cannot give the
            answer away. Optional.
          </span>
        </div>
      </div>
    </Card>
  );
}

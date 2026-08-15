import { useEffect, useMemo, useState } from 'react';
import {
  contentApi,
  errorMessage,
  type ApiCategoryKey,
  type ApiQuestion,
  type UpsertQuestionRequest,
} from '@/shared/api';
import {
  Badge,
  Banner,
  Button,
  Card,
  Field,
  Input,
  Loading,
  Select,
  Textarea,
} from '@/shared/components/ui';
import { useAsync } from '@/shared/lib/use-async';
import { categoryColor, categoryMeta } from '@/shared/theme/colors';

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
const MIN_CHOICES = 2;
const MAX_CHOICES = 8;

/** The editor's working copy — the API shape with the two variants flattened. */
interface Draft {
  type: 'multiple-choice' | 'enumeration';
  question: string;
  hint: string;
  explanation: string;
  choices: string[];
  correctAnswer: string;
  answerPool: string[];
  requiredAnswers: number;
}

function toDraft(q: ApiQuestion): Draft {
  const choices = q.choices?.length ? [...q.choices] : ['', ''];
  return {
    type: q.type,
    question: q.question ?? '',
    hint: q.hint ?? '',
    explanation: q.explanation ?? '',
    choices,
    correctAnswer: q.correctAnswer ?? '',
    answerPool: q.answerPool ? [...q.answerPool] : [],
    requiredAnswers: q.requiredAnswers ?? 3,
  };
}

/** Mirrors juanwise-be `content.schema.ts` so a save is not spent on a 422. */
function validate(draft: Draft): string | null {
  if (!draft.question.trim()) return 'Write the question first.';

  if (draft.type === 'multiple-choice') {
    const choices = draft.choices.map((c) => c.trim()).filter(Boolean);
    if (choices.length < MIN_CHOICES) return `Give at least ${MIN_CHOICES} choices.`;
    if (choices.length > MAX_CHOICES) return `Give at most ${MAX_CHOICES} choices.`;
    if (new Set(choices).size !== choices.length) return 'Two choices are identical.';
    if (!draft.correctAnswer.trim()) return 'Mark which choice is the correct answer.';
    if (!choices.includes(draft.correctAnswer.trim()))
      return 'The correct answer must be one of the choices.';
    return null;
  }

  const pool = draft.answerPool.map((a) => a.trim()).filter(Boolean);
  if (pool.length < 10) return 'Enumeration needs an answer pool of at least 10 entries.';
  if (draft.requiredAnswers < 1) return 'Required answers must be at least 1.';
  if (draft.requiredAnswers > pool.length)
    return 'Required answers cannot exceed the size of the answer pool.';
  return null;
}

function toRequest(draft: Draft): UpsertQuestionRequest {
  const common = {
    question: draft.question.trim(),
    hint: draft.hint.trim() || null,
    explanation: draft.explanation.trim() || null,
  };

  if (draft.type === 'enumeration') {
    return {
      ...common,
      type: 'enumeration',
      answerPool: draft.answerPool.map((a) => a.trim()).filter(Boolean),
      requiredAnswers: draft.requiredAnswers,
    };
  }

  return {
    ...common,
    type: 'multiple-choice',
    choices: draft.choices.map((c) => c.trim()).filter(Boolean),
    correctAnswer: draft.correctAnswer.trim(),
  };
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
  const [draft, setDraft] = useState<Draft>(() => toDraft(question));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<'save' | 'revert' | null>(null);

  // A different slot mounts a fresh editor (`key` on the element), but the same
  // slot reloading after a save should pick up what the server stored.
  useEffect(() => {
    setDraft(toDraft(question));
  }, [question]);

  const patch = (next: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setSaved(false);
    setError(null);
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
    const problem = validate(draft);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy('save');
    setError(null);
    try {
      await contentApi.upsertQuestion(category, level, activityNum, toRequest(draft));
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
            Save
          </Button>
        </>
      }
    >
      <div className="grid" style={{ gap: 16 }}>
        {error && <Banner tone="error">{error}</Banner>}
        {saved && !error && <Banner tone="success">Saved. Every player sees this now.</Banner>}

        <Field label="Question type" hint="The game renders these two; nothing else has a server form.">
          <Select
            value={draft.type}
            onChange={(e) => patch({ type: e.target.value as Draft['type'] })}
            style={{ width: 240 }}
          >
            <option value="multiple-choice">Multiple choice</option>
            <option value="enumeration">Enumeration</option>
          </Select>
        </Field>

        <Field label="Question">
          <Textarea
            value={draft.question}
            onChange={(e) => patch({ question: e.target.value })}
            placeholder="Sino ang itinuturing na pambansang bayani ng Pilipinas?"
            style={{ minHeight: 76 }}
          />
        </Field>

        {draft.type === 'multiple-choice' ? (
          <Field
            label="Choices"
            hint="Click a circle to mark the correct answer. Two to eight choices."
          >
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
          </Field>
        ) : (
          <>
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
          </>
        )}

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
      </div>
    </Card>
  );
}

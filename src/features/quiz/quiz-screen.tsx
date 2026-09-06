import { useEffect, useMemo, useState } from 'react';
import { contentApi, errorMessage, type ApiCategoryKey, type ApiQuestion } from '@/shared/api';
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
import {
  MAX_CHOICES,
  MIN_CHOICES,
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

  // A different slot mounts a fresh editor (`key` on the element), but the same
  // slot reloading after a save should pick up what the server stored.
  useEffect(() => {
    setDraft(toQuizDraft(question));
  }, [question]);

  const patch = (next: Partial<QuizDraft>) => {
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
            onChange={(e) => patch({ type: e.target.value as QuizDraft['type'] })}
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

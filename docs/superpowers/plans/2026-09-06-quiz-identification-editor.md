# Quiz Identification and Editor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Identification as a supported server-authored quiz type and ship the approved type-card web editor with safe question-type switching and flexible mobile answer matching.

**Architecture:** Extend the backend discriminated union and Firestore document mapping first, then update the mobile and web API contracts. Put grading and web-draft transformations in pure modules with direct unit tests; UI screens consume those modules and remain responsible only for rendering, confirmation state, and API calls.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, Express, Zod, Firebase Admin/Firestore, Expo SDK 57, React Native.

**Spec:** `docs/superpowers/specs/2026-09-06-quiz-identification-editor-design.md`

## Global Constraints

- The three repositories are siblings: `juanwise-admin`, `../juanwise-be`, and `../juanwise-app-v2`.
- Preserve Question, Hint, and Explanation across type switches; clear incompatible answer data only after explicit confirmation.
- Identification matching trims outer whitespace, collapses repeated internal whitespace, and lowercases; it does not remove accents or punctuation.
- `acceptedAnswers` contains alternatives only; `correctAnswer` remains the required primary answer.
- Identification allows zero to 20 alternatives, each no longer than 200 characters, with normalized uniqueness across the primary and alternatives.
- Deploy the backend before allowing the admin to publish Identification questions; do not migrate existing questions.
- Do not redesign the mobile quiz-playing screen, mobile admin editor, or backend embedded editor.
- Follow red-green-refactor for every production behavior and keep commits scoped to the repository changed by that task.

---

### Task 1: Backend Identification contract and validation

**Files:**
- Modify: `../juanwise-be/src/modules/content/content.schema.ts`
- Create: `../juanwise-be/tests/content-question-schema.test.ts`

**Interfaces:**
- Produces: `questionTypeSchema` including `'identification'`.
- Produces: `QuestionDto.acceptedAnswers: string[] | null`.
- Produces: `UpsertQuestionInput` Identification branch with `correctAnswer: string` and `acceptedAnswers?: string[]`.

- [ ] **Step 1: Write failing schema tests**

Import `questionSchema` and `upsertQuestionSchema`. Add tests for a valid payload, a missing primary answer, more than 20 alternatives, a value over 200 characters, and normalized duplicates:

```ts
import { describe, expect, it } from 'vitest';
import { questionSchema, upsertQuestionSchema } from '../src/modules/content/content.schema.js';

const base = {
  type: 'identification' as const,
  question: 'Who founded the Katipunan?',
  correctAnswer: 'Andrés Bonifacio',
  acceptedAnswers: ['Andres Bonifacio', 'Bonifacio'],
};

it('accepts an identification question with alternatives', () => {
  expect(upsertQuestionSchema.parse(base)).toMatchObject(base);
});

it.each([
  [{ ...base, correctAnswer: '   ' }, 'correctAnswer'],
  [{ ...base, acceptedAnswers: Array(21).fill(0).map((_, i) => `answer ${i}`) }, 'acceptedAnswers'],
  [{ ...base, acceptedAnswers: ['x'.repeat(201)] }, 'acceptedAnswers'],
  [{ ...base, acceptedAnswers: ['  ANDRÉS   BONIFACIO  '] }, 'acceptedAnswers'],
])('rejects invalid identification payload %#', (payload, field) => {
  const result = upsertQuestionSchema.safeParse(payload);
  expect(result.success).toBe(false);
  expect(JSON.stringify(result.error?.issues)).toContain(field);
});
```

Also parse a complete Identification response through `questionSchema` and assert `acceptedAnswers` is retained.

- [ ] **Step 2: Run the tests and verify RED**

Run: `cd ../juanwise-be && npm test -- tests/content-question-schema.test.ts`

Expected: FAIL because `identification` and `acceptedAnswers` are absent.

- [ ] **Step 3: Implement the schema branch**

Add a local normalization helper used only for duplicate validation:

```ts
const normalizeAnswer = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();
```

Extend `questionTypeSchema`, add nullable `acceptedAnswers` to `questionSchema`, and define:

```ts
const identificationSchema = z
  .object({
    ...questionCommon,
    type: z.literal('identification'),
    correctAnswer: z.string().trim().min(1).max(200),
    acceptedAnswers: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  })
  .superRefine((value, ctx) => {
    const normalized = [value.correctAnswer, ...(value.acceptedAnswers ?? [])]
      .map(normalizeAnswer);
    if (new Set(normalized).size !== normalized.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['acceptedAnswers'],
        message: 'Accepted answers must be unique',
      });
    }
  });
```

Add it to `upsertQuestionSchema`'s discriminated union.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd ../juanwise-be && npm test -- tests/content-question-schema.test.ts && npm run typecheck`

Expected: all new tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the backend contract**

```bash
cd ../juanwise-be
git add src/modules/content/content.schema.ts tests/content-question-schema.test.ts
git commit -m "feat: add identification question schema"
```

---

### Task 2: Backend Firestore mapping and API documentation

**Files:**
- Modify: `../juanwise-be/src/modules/content/content.repository.ts`
- Modify: `../juanwise-be/src/modules/content/content.routes.ts`
- Modify: `../juanwise-be/src/config/tester.ts`
- Modify: `../juanwise-be/src/web/webapp.ts`
- Modify: `../juanwise-be/tests/content-question-schema.test.ts`
- Modify: `../juanwise-be/tests/app.test.ts`

**Interfaces:**
- Consumes: the Identification `UpsertQuestionInput` and `QuestionDto` from Task 1.
- Produces: Firestore documents whose irrelevant fields are explicitly null.
- Produces: OpenAPI documentation for all three question types.

- [ ] **Step 1: Add failing response/OpenAPI assertions**

In the schema test, prove an older document-style response accepts `acceptedAnswers: null` and an Identification response accepts alternatives. In `app.test.ts`, inspect `buildOpenApiDocument()` and assert the `UpsertQuestionRequest` schema JSON contains `identification` and `acceptedAnswers`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `cd ../juanwise-be && npm test -- tests/content-question-schema.test.ts tests/app.test.ts`

Expected: FAIL on the missing persistence/documentation fields.

- [ ] **Step 3: Update repository reads and full overwrites**

In `toQuestion`, return `acceptedAnswers: d.acceptedAnswers ?? null`.

In `upsertQuestion`, use these exact ownership rules:

```ts
choices: input.type === 'multiple-choice' ? input.choices : null,
correctAnswer:
  input.type === 'multiple-choice' || input.type === 'identification'
    ? input.correctAnswer
    : null,
answerPool: input.type === 'enumeration' ? input.answerPool : null,
requiredAnswers: input.type === 'enumeration' ? input.requiredAnswers : null,
acceptedAnswers: input.type === 'identification' ? input.acceptedAnswers ?? [] : null,
```

Update the repository comment to name all three types.

- [ ] **Step 4: Update human-facing API guidance and protect the legacy editor**

Revise the content route description and tester note to document Identification's required `correctAnswer` and optional `acceptedAnswers`. Do not add Identification authoring controls to the legacy embedded backend page. When that page loads an Identification question, show `Identification (edit in JuanWise Admin)` as a disabled/current type, display the primary and alternative answers read-only, and disable its save action so the page cannot reinterpret the question as Enumeration.

- [ ] **Step 5: Run the complete backend suite**

Run: `cd ../juanwise-be && npm test && npm run typecheck`

Expected: all Vitest tests PASS and typecheck exits 0.

- [ ] **Step 6: Commit backend persistence**

```bash
cd ../juanwise-be
git add src/modules/content/content.repository.ts src/modules/content/content.routes.ts src/config/tester.ts src/web/webapp.ts tests/content-question-schema.test.ts tests/app.test.ts
git commit -m "feat: persist identification answers"
```

---

### Task 3: Mobile answer normalization and matching

**Files:**
- Modify: `../juanwise-app-v2/package.json`
- Modify: `../juanwise-app-v2/package-lock.json`
- Create: `../juanwise-app-v2/src/features/learning/lib/answer-matching.ts`
- Create: `../juanwise-app-v2/src/features/learning/lib/answer-matching.test.ts`

**Interfaces:**
- Produces: `normalizeAnswer(value: string): string`.
- Produces: `matchesIdentificationAnswer(given: string, correctAnswer: string, acceptedAnswers?: string[] | null): boolean`.

- [ ] **Step 1: Add Vitest and the failing matcher tests**

Run `cd ../juanwise-app-v2 && npm install --save-dev vitest` and add `"test": "vitest run"` to scripts. Then create tests:

```ts
import { describe, expect, it } from 'vitest';
import { matchesIdentificationAnswer, normalizeAnswer } from './answer-matching';

describe('normalizeAnswer', () => {
  it('trims, collapses whitespace, and lowercases', () => {
    expect(normalizeAnswer('  Andres   BONIFACIO ')).toBe('andres bonifacio');
  });
});

describe('matchesIdentificationAnswer', () => {
  it('matches the primary answer', () => {
    expect(matchesIdentificationAnswer(' ANDRÉS  BONIFACIO ', 'Andrés Bonifacio')).toBe(true);
  });

  it('matches an accepted alternative', () => {
    expect(matchesIdentificationAnswer('bonifacio', 'Andrés Bonifacio', ['Bonifacio'])).toBe(true);
  });

  it('does not strip accents or accept unrelated text', () => {
    expect(matchesIdentificationAnswer('Andres Bonifacio', 'Andrés Bonifacio')).toBe(false);
    expect(matchesIdentificationAnswer('Jose Rizal', 'Andrés Bonifacio', ['Bonifacio'])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd ../juanwise-app-v2 && npm test -- src/features/learning/lib/answer-matching.test.ts`

Expected: FAIL because the matcher module does not exist.

- [ ] **Step 3: Implement the pure matcher**

```ts
export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function matchesIdentificationAnswer(
  given: string,
  correctAnswer: string,
  acceptedAnswers: string[] | null = [],
): boolean {
  const normalizedGiven = normalizeAnswer(given);
  if (!normalizedGiven) return false;
  return [correctAnswer, ...(acceptedAnswers ?? [])]
    .some((answer) => normalizeAnswer(answer) === normalizedGiven);
}
```

- [ ] **Step 4: Run the matcher tests**

Run: `cd ../juanwise-app-v2 && npm test -- src/features/learning/lib/answer-matching.test.ts`

Expected: all matcher tests PASS.

- [ ] **Step 5: Commit the mobile matcher**

```bash
cd ../juanwise-app-v2
git add package.json package-lock.json src/features/learning/lib/answer-matching.ts src/features/learning/lib/answer-matching.test.ts
git commit -m "test: define identification answer matching"
```

---

### Task 4: Mobile API mapping and student grading

**Files:**
- Modify: `../juanwise-app-v2/src/shared/api/types.ts`
- Modify: `../juanwise-app-v2/src/shared/content/quiz-content.ts`
- Create: `../juanwise-app-v2/src/features/admin/lib/question-mapping.ts`
- Create: `../juanwise-app-v2/src/features/admin/lib/question-mapping.test.ts`
- Modify: `../juanwise-app-v2/src/features/admin/context/admin-content-context.tsx`
- Modify: `../juanwise-app-v2/src/features/admin/screens/question-editor-screen.tsx`
- Modify: `../juanwise-app-v2/src/features/learning/screens/activity-play-screen.tsx`

**Interfaces:**
- Consumes: `matchesIdentificationAnswer` from Task 3.
- Produces: mobile `ApiQuestion` and `QuizQuestion` shapes carrying `acceptedAnswers`.
- Produces: student grading against primary and alternative Identification answers.

- [ ] **Step 1: Write a failing Identification mapping test**

Create a complete `ApiQuestion` fixture with `type: 'identification'`, primary answer, and alternatives. Assert that `toQuizQuestion(api, fallback)` returns `type: 'identification'`, preserves `correctAnswer`, and copies `acceptedAnswers`.

- [ ] **Step 2: Run the mapping test and verify RED**

Run: `cd ../juanwise-app-v2 && npm test -- src/features/admin/lib/question-mapping.test.ts`

Expected: FAIL because the mapping module does not exist.

- [ ] **Step 3: Extend the mobile types and implement mapping**

Add `identification` to `ApiQuestionType`, add `acceptedAnswers: string[] | null` to `ApiQuestion`, add an Identification branch to `UpsertQuestionRequest`, and add `acceptedAnswers?: string[]` to `QuizQuestion`. Move `toQuizQuestion` from the context into the new pure mapping module and export it.

- [ ] **Step 4: Map Identification API responses explicitly**

In the extracted `toQuizQuestion`, add an Identification branch before the Multiple Choice fallback:

```ts
if (api.type === 'identification') {
  return {
    hint: api.hint ?? fallback.hint,
    type: 'identification',
    question: api.question,
    correctAnswer: api.correctAnswer ?? '',
    acceptedAnswers: api.acceptedAnswers ?? [],
    explanation: api.explanation ?? fallback.explanation,
  };
}
```

Update stale comments that say the API supports only two types.

- [ ] **Step 5: Run mapping tests and verify GREEN**

Run: `cd ../juanwise-app-v2 && npm test -- src/features/admin/lib/question-mapping.test.ts`

Expected: the mapping test PASS.

- [ ] **Step 6: Make the mobile admin safe for Identification**

Remove the conversion that opens an Identification question as Multiple Choice. When the existing type is Identification, render its saved question and answers read-only with copy directing the administrator to the web console; disable or omit its Save action. Do not build new mobile authoring controls.

- [ ] **Step 7: Use the matcher in the student activity screen**

Import `matchesIdentificationAnswer`. Include `correctAnswer` and `acceptedAnswers` in `questionSignature`. Replace the single equality helper with type-aware logic:

```ts
const isCorrect = (given: string) =>
  q.type === 'identification'
    ? matchesIdentificationAnswer(given, q.correctAnswer, q.acceptedAnswers)
    : given.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
```

Do not alter Multiple Choice or Enumeration scoring payloads.

- [ ] **Step 8: Run mobile verification**

Run: `cd ../juanwise-app-v2 && npm test && npx tsc --noEmit && npm run lint`

Expected: matcher tests PASS, TypeScript exits 0, and Expo lint reports no errors.

- [ ] **Step 9: Commit mobile integration**

```bash
cd ../juanwise-app-v2
git add src/shared/api/types.ts src/shared/content/quiz-content.ts src/features/admin/lib/question-mapping.ts src/features/admin/lib/question-mapping.test.ts src/features/admin/context/admin-content-context.tsx src/features/admin/screens/question-editor-screen.tsx src/features/learning/screens/activity-play-screen.tsx
git commit -m "feat: play server-authored identification quizzes"
```

---

### Task 5: Web-admin draft rules and API contract

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/shared/api/types.ts`
- Create: `src/features/quiz/quiz-draft.ts`
- Create: `src/features/quiz/quiz-draft.test.ts`
- Modify: `src/features/quiz/quiz-screen.tsx`

**Interfaces:**
- Produces: exported `QuizDraft` type.
- Produces: `toQuizDraft`, `validateQuizDraft`, `toQuestionRequest`, `hasAnswerContent`, and `switchQuestionType`.
- `switchQuestionType(draft, nextType)` returns a new draft preserving common fields and resetting all answer fields to safe defaults for the target type.

- [ ] **Step 1: Install Vitest and add the test command**

Run: `npm install --save-dev vitest` and add `"test": "vitest run"` to `package.json` scripts.

- [ ] **Step 2: Write failing draft-rule tests**

Cover these exact cases in `quiz-draft.test.ts`:

```ts
it('serializes only identification answer fields', () => {
  expect(toQuestionRequest(identificationDraft)).toEqual({
    type: 'identification',
    question: 'Who founded the Katipunan?',
    hint: null,
    explanation: null,
    correctAnswer: 'Andrés Bonifacio',
    acceptedAnswers: ['Andres Bonifacio', 'Bonifacio'],
  });
});

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
```

Also test normalized duplicate rejection, empty primary rejection, maximum 20 alternatives, meaningful-content detection for each type, and that blank Multiple Choice placeholders do not count as meaningful content.

- [ ] **Step 3: Run the tests and verify RED**

Run: `npm test -- src/features/quiz/quiz-draft.test.ts`

Expected: FAIL because `quiz-draft.ts` does not exist.

- [ ] **Step 4: Implement the draft module**

Move the existing draft conversion, validation, and serialization out of `quiz-screen.tsx`. Extend the type:

```ts
export interface QuizDraft {
  type: ApiQuestionType;
  question: string;
  hint: string;
  explanation: string;
  choices: string[];
  correctAnswer: string;
  answerPool: string[];
  requiredAnswers: number;
  acceptedAnswers: string[];
}
```

Use the same normalization rule as the backend for duplicate checks. `hasAnswerContent` checks only fields owned by `draft.type`. `switchQuestionType` resets all answer-related fields and preserves only the three common text fields.

- [ ] **Step 5: Extend web API types**

Add Identification and `acceptedAnswers` to the same public shapes defined in Task 1. Update `quiz-screen.tsx` imports to use the draft module without changing the rendered UI yet.

- [ ] **Step 6: Run tests, typecheck, and build**

Run: `npm test && npm run typecheck && npm run build`

Expected: tests PASS, typecheck exits 0, and Vite builds successfully.

- [ ] **Step 7: Commit draft behavior**

```bash
git add package.json package-lock.json src/shared/api/types.ts src/features/quiz/quiz-draft.ts src/features/quiz/quiz-draft.test.ts src/features/quiz/quiz-screen.tsx
git commit -m "feat: add identification quiz drafts"
```

---

### Task 6: Accessible confirmation dialog

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/shared/components/ui.tsx`
- Create: `src/shared/components/ui.test.tsx`
- Create: `src/test/setup.ts`
- Modify: `vite.config.ts`
- Modify: `src/index.css`
- Modify: `src/features/quiz/quiz-screen.tsx`

**Interfaces:**
- Produces: `ConfirmDialog` with `open`, `title`, `children`, `confirmLabel`, `cancelLabel`, `danger`, `onConfirm`, and `onCancel` props.
- Consumes: `hasAnswerContent` and `switchQuestionType` from Task 5.

- [ ] **Step 1: Add DOM test dependencies and write a failing dialog test**

Run `npm install --save-dev @testing-library/react @testing-library/jest-dom jsdom`. Configure Vitest in `vite.config.ts` with `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }`. In `src/test/setup.ts`, import `@testing-library/jest-dom/vitest` and polyfill `HTMLDialogElement.prototype.showModal`/`close` by toggling the `open` property because jsdom does not implement those methods. Test that an open dialog renders its title, Escape calls `onCancel`, the safe button calls `onCancel`, and the destructive button calls `onConfirm`.

- [ ] **Step 2: Run the dialog test and verify RED**

Run: `npm test -- src/shared/components/ui.test.tsx`

Expected: FAIL because `ConfirmDialog` is not exported.

- [ ] **Step 3: Implement dialog semantics with the native dialog element**

Use a `ref<HTMLDialogElement>`, call `showModal()` only when `open && !dialog.open`, and call `close()` when `!open && dialog.open`. Handle the native `cancel` event by preventing default and calling `onCancel`. Give the heading a stable id and set `aria-labelledby` on the dialog.

The destructive action must say `Change and clear answers`; the safe action must say `Keep {Current type}`.

- [ ] **Step 4: Run the dialog test and verify GREEN**

Run: `npm test -- src/shared/components/ui.test.tsx`

Expected: dialog tests PASS.

- [ ] **Step 5: Wire pending type selection into the editor**

Store `pendingType: ApiQuestionType | null`. On card selection:

```ts
if (nextType === draft.type) return;
if (hasAnswerContent(draft)) setPendingType(nextType);
else patch(switchQuestionType(draft, nextType));
```

Cancel sets `pendingType` to null. Confirm applies `switchQuestionType`, then clears `pendingType`. The dialog body names the preserved common fields and the exact answer content being removed.

- [ ] **Step 6: Style and manually verify dialog behavior**

Add `.dialog`, `.dialog::backdrop`, `.dialog__warning`, and `.dialog__actions` styles using existing design tokens. Verify mouse, Tab, Shift+Tab, Escape, cancel, and confirm flows in the local browser. Confirm cancel leaves every draft field unchanged.

- [ ] **Step 7: Run automated checks**

Run: `npm test && npm run typecheck && npm run build`

Expected: all checks exit 0.

- [ ] **Step 8: Commit safe switching**

```bash
git add package.json package-lock.json vite.config.ts src/test/setup.ts src/shared/components/ui.tsx src/shared/components/ui.test.tsx src/index.css src/features/quiz/quiz-screen.tsx
git commit -m "feat: confirm destructive quiz type changes"
```

---

### Task 7: Build the approved Option A web editor

**Files:**
- Modify: `src/features/quiz/quiz-screen.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: draft rules from Task 5 and `ConfirmDialog` from Task 6.
- Produces: three accessible type cards and adaptive answer sections.

- [ ] **Step 1: Replace the type select with a labeled radio-card group**

Render a `fieldset` with a `legend` reading `1. Choose question type`. Each card contains an actual visually integrated radio input, label, and approved description. Use the existing category color only for the selected border/focus accent; retain the JuanWise blue as the primary action color.

- [ ] **Step 2: Add numbered Question and Answer sections**

Label the shared textarea `2. Write the question`. Label the adaptive section `3. Configure the answer`, with type-specific subcopy. Retain existing Multiple Choice and Enumeration behavior while moving it under the new hierarchy.

- [ ] **Step 3: Render Identification fields**

Add the required Correct answer input, repeatable Other accepted answers inputs, remove buttons, and Add accepted answer button. Disable Add at 20 alternatives. Keep empty alternatives visible while editing but remove them during serialization.

- [ ] **Step 4: Improve save feedback and validation placement**

Keep the status/actions in the card header. Change the button label to `Save changes`. Show validation errors above the numbered sections and keep the draft intact after failures. Preserve Revert to default behavior.

- [ ] **Step 5: Add responsive and focus styling**

Create quiz-scoped classes rather than inline layout styles. Use a three-column type-card row on desktop, one column on narrow screens, visible `:focus-visible` rings, a quiet numbered-section treatment, and no decorative animation beyond hover/focus transitions. Do not change global sidebar/navigation styling.

- [ ] **Step 6: Verify the complete web flow**

Run: `npm test && npm run typecheck && npm run build`

Then run `npm run dev`, inspect desktop and narrow widths, and manually verify all three types, empty and populated switching, dialog cancel/confirm, validation, saving, and revert behavior.

- [ ] **Step 7: Commit the approved editor**

```bash
git add src/features/quiz/quiz-screen.tsx src/index.css
git commit -m "feat: redesign quiz authoring editor"
```

---

### Task 8: Cross-repository compatibility and final verification

**Files:**
- Modify only files required to fix issues revealed by the commands below.

**Interfaces:**
- Verifies the shared `identification`, `correctAnswer`, and `acceptedAnswers` contract across all three repositories.

- [ ] **Step 1: Search for stale two-type assumptions**

Run:

```bash
rg -n "multiple-choice and enumeration only|supports only two|PUBLISHABLE_TYPES|ApiQuestionType" \
  . ../juanwise-be ../juanwise-app-v2 \
  -g '!**/node_modules/**' -g '!**/.superpowers/**'
```

Review each result. Fix only assumptions that would reject, reinterpret, or fail to render Identification.

- [ ] **Step 2: Run all repository checks from a clean command invocation**

```bash
(cd ../juanwise-be && npm test && npm run typecheck)
(cd ../juanwise-app-v2 && npm test && npx tsc --noEmit && npm run lint)
(npm test && npm run typecheck && npm run build)
```

Expected: every command exits 0 with no test failures or TypeScript errors.

- [ ] **Step 3: Review diffs and repository status**

Run:

```bash
git status --short && git diff --check
git -C ../juanwise-be status --short && git -C ../juanwise-be diff --check
git -C ../juanwise-app-v2 status --short && git -C ../juanwise-app-v2 diff --check
```

Confirm there are no unrelated edits, generated build artifacts, or committed `.superpowers` files.

- [ ] **Step 4: Perform the end-to-end smoke test**

With the backend and web admin running against the same development configuration:

1. Open an authored Multiple Choice activity and select Identification.
2. Confirm cancel preserves its choices and selected answer.
3. Confirm destructive switching preserves question/hint/explanation and clears choices.
4. Save primary `Andrés Bonifacio` with alternatives `Andres Bonifacio` and `Bonifacio`.
5. Reload the admin and confirm all Identification values persist.
6. Open the same activity in the mobile app and pass using `  BONIFACIO  `.
7. Verify `Andres Bonifacio` succeeds because it is explicit, while an unlisted misspelling fails.
8. Revert the activity and confirm the seeded default returns.

- [ ] **Step 5: Record final commit state**

If smoke-test fixes produced changes, commit them in the repository they belong to with a narrowly scoped message. Record the final commit hash from each repository in the handoff summary.

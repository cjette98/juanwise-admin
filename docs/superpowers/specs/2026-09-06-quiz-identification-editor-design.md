# Quiz Identification and Editor Redesign

## Objective

Make quiz authoring easier for teachers and add Identification as a fully supported question type across the JuanWise admin console, backend API, and mobile game.

The approved visual direction is **Option A: type cards**. The existing category, level, and activity selection flow remains familiar. The question editor becomes a clearly ordered form whose answer section adapts to the selected type.

## Scope

This feature spans three sibling repositories:

- `juanwise-admin`: redesigned web quiz editor and API types.
- `juanwise-be`: API schema, validation, persistence, and OpenAPI documentation.
- `juanwise-app-v2`: API mapping and Identification answer grading in the student game.

The mobile admin editor and the backend's legacy embedded web editor are not redesigned in this change. They must remain type-safe and must not break when reading an Identification question; publishing Identification continues through `juanwise-admin`. The mobile admin editor must not silently reinterpret Identification as Multiple Choice: it shows the saved Identification values but directs editing to the web admin until a dedicated mobile-authoring design is approved.

## User Experience

### Activity selection

The existing Category, Level, and six Activity controls stay at the top of the page. Their behavior does not change. The selected activity remains visibly highlighted and continues to show whether it is Authored or Default.

### Editor hierarchy

The editor uses three numbered sections:

1. **Choose question type** — three selectable cards, each with a concise explanation.
2. **Write the question** — the shared question text field.
3. **Configure the answer** — fields specific to the selected type.

The cards are:

- **Multiple choice** — “Students choose one correct answer.”
- **Enumeration** — “Students supply several answers.”
- **Identification** — “Students type one answer.”

Hint and Explanation remain optional shared fields below the answer configuration. The header retains the Authored/Default status, Revert to default action, and Save changes action.

### Type-specific answer fields

**Multiple choice** keeps the existing two-to-eight editable choices. A teacher selects the correct choice using its circular marker.

**Enumeration** keeps the answer pool textarea and required-answer count. The pool requires at least ten non-empty entries, and the required count must be between one and the number of unique pool entries.

**Identification** provides:

- A required **Correct answer** field.
- An optional repeatable **Other accepted answers** list.
- An **Add accepted answer** action and a remove action for each alternative.
- Helper copy: “Capitalization and extra spaces are ignored.”

Example:

- Correct answer: `Andrés Bonifacio`
- Other accepted answers: `Andres Bonifacio`, `Bonifacio`

### Safe question-type switching

Common fields—Question, Hint, and Explanation—are preserved when the type changes.

Each type owns its answer data:

- Multiple choice: `choices` and `correctAnswer`
- Enumeration: `answerPool` and `requiredAnswers`
- Identification: `correctAnswer` and `acceptedAnswers`

When a teacher selects a different type and the current type has meaningful answer content, show a confirmation dialog before changing:

- Title: `Change to {Type}?`
- Body: `Your question, hint, and explanation will stay.`
- Warning states exactly what will be cleared, including counts where useful.
- Cancel action: `Keep {Current type}`
- Destructive action: `Change and clear answers`

Cancel leaves the draft untouched. Confirm clears the old type's answer fields, initializes the new type's answer fields, and changes the selected card. No dialog appears when the current answer section has no meaningful content. Placeholder blank rows do not count as content.

Switching does not write to the server. Data changes remain local until Save changes is selected.

## Data Contract

Extend `ApiQuestionType` and the backend question type schema with `identification`.

Add one nullable response/storage field:

```ts
acceptedAnswers: string[] | null
```

Identification writes use this request shape:

```ts
{
  type: 'identification';
  question: string;
  hint?: string | null;
  explanation?: string | null;
  correctAnswer: string;
  acceptedAnswers?: string[];
}
```

`correctAnswer` is the primary answer displayed in authored content and feedback. `acceptedAnswers` contains only optional alternatives. Responses for older Multiple Choice and Enumeration documents remain backward compatible because the new field is nullable.

The backend performs a full overwrite for every type so stale fields cannot survive a type change:

| Saved type | `choices` | `correctAnswer` | `answerPool` | `requiredAnswers` | `acceptedAnswers` |
|---|---|---|---|---|---|
| Multiple choice | choices | primary choice | null | null | null |
| Enumeration | null | null | pool | count | null |
| Identification | null | primary answer | null | null | alternatives |

## Validation and Matching

Backend validation for Identification requires:

- Non-empty question text under the existing common limits.
- A trimmed, non-empty primary correct answer.
- Zero to 20 optional accepted alternatives.
- Every alternative is trimmed, non-empty, and no longer than 200 characters.
- The primary answer and alternatives are unique after normalization.

For this feature, normalization means:

1. Trim leading and trailing whitespace.
2. Collapse consecutive internal whitespace to one space.
3. Convert to lowercase.

Matching deliberately does not remove accents, punctuation, or words. Variants such as `Andrés` and `Andres` must be entered separately, making accepted grading explicit and predictable.

The mobile game considers an Identification response correct when its normalized value equals the normalized primary answer or any normalized accepted alternative. Multiple Choice and Enumeration grading behavior remains unchanged.

## Component and Code Boundaries

### Admin web

Keep API-independent editor rules in a small quiz draft module so they can be unit tested:

- draft creation from an API question
- validation
- request serialization
- detection of meaningful type-specific content
- clearing and initializing answer data during a confirmed type switch

The screen owns dialog state and rendering. Reusable global UI primitives should only be extended where the confirmation dialog or type-card accessibility requires it.

The type cards use real radio semantics: one labeled radio per type, visible focus styling, and keyboard selection. The confirmation dialog traps focus, labels its title/body, supports Escape as cancel, and restores focus to the selected card trigger.

### Backend

The content schema is the source of truth for request validation and generated OpenAPI output. The repository maps Identification fields explicitly and writes null to fields belonging to other types.

No migration is required. Firestore is schemaless, existing documents remain readable, and `acceptedAnswers` defaults to null when absent.

### Mobile

The shared API model maps Identification responses to the existing `QuizQuestion` model. Add `acceptedAnswers` to that internal model rather than overloading the Enumeration pool.

Extract normalization/matching into a pure helper used by the activity screen. This keeps grading testable and ensures the question signature includes Identification answer changes so an updated server question resets the input state.

## Error Handling

- Admin validation errors appear above the editor and focus or identify the invalid section.
- A rejected save preserves the complete local draft.
- A canceled type switch preserves all fields exactly.
- A failed save never changes the Authored/Default status.
- Older API responses without `acceptedAnswers` are treated as having no alternatives.
- An Identification question with malformed or missing `correctAnswer` is rejected by the backend and is never publishable.

## Testing

### Admin web

Add focused unit tests for the extracted draft rules:

- Identification validation accepts a primary answer with optional alternatives.
- Empty primary answers and normalized duplicates are rejected.
- Serialization sends only Identification fields.
- Switching preserves common fields and clears all prior answer-type fields only after confirmation.
- Blank placeholder rows do not trigger the confirmation.

Add component tests for selecting a type card, canceling the confirmation, confirming the destructive switch, and keyboard-accessible selection if the repository's test setup supports DOM rendering. If introducing a DOM test stack is disproportionate, retain pure rule tests and verify the rendered interaction through the local browser.

### Backend

Add schema tests proving valid Identification payloads pass and invalid/duplicate answers fail. Add repository mapping coverage where existing Firebase test seams allow it. Verify OpenAPI generation includes the third discriminated-union branch and `acceptedAnswers`.

### Mobile

Add pure matcher tests for trimming, repeated whitespace, capitalization, accepted alternatives, accented variants, and incorrect answers. Run TypeScript and Expo lint checks after updating API/context mappings.

### Final verification

Run each repository's available full checks:

- `juanwise-admin`: unit tests, `npm run typecheck`, `npm run build`
- `juanwise-be`: `npm test`, `npm run typecheck`
- `juanwise-app-v2`: matcher tests, `npx tsc --noEmit`, `npm run lint`

Manually verify one activity can be authored as each type, that the warning appears only when answer data would be lost, and that a student can pass Identification using both the primary answer and an accepted alternative.

## Rollout and Compatibility

Deploy the backend before publishing an Identification question from the admin. Then deploy the admin and mobile updates. Older mobile clients do not understand server-authored Identification reliably, so administrators must not publish this type until the compatible mobile build is distributed.

No existing questions are converted. Reverting an authored Identification question returns the activity to its existing seeded default.

## Out of Scope

- Fuzzy spelling, typo tolerance, stemming, or AI-based answer grading.
- Accent-insensitive matching unless the teacher explicitly adds the unaccented variant.
- Redesigning the mobile quiz-playing screen.
- Redesigning the mobile admin editor or backend embedded web editor.
- Autosave, version history, draft recovery, or bulk question editing.

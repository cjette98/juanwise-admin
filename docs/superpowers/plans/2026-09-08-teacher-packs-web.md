# Teacher Access to Content Packs — Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher log into the `juanwise-admin` web console and author/duplicate/publish content packs and assign them to the classes they handle — matching what the backend's `feat/content-packs` branch already exposes and what mobile's `(admin)` route group already does — without opening the org-wide Teachers/Students/Leaderboard screens to teachers.

**Architecture:** Widen the auth gate to accept `teacher` alongside `admin`; make the sidebar nav role-aware; add a Packs library screen and a My Classes screen (teacher-only); retrofit the existing Quiz and Jigsaw screens to take a `packId` route param and call the pack-scoped API instead of the `/content/*` shim. The system pack (`system-default`) is just another pack, so an admin's existing workflow becomes "open the system pack" through the same screens — no parallel admin-only UI.

**Tech Stack:** React 19, TypeScript, React Router 7, Vite, Vitest + React Testing Library + `@testing-library/user-event`.

**Spec:** `docs/superpowers/specs/2026-09-08-teacher-packs-web-design.md`

## Global Constraints

- **This is a client of `juanwise-be` branch `feat/content-packs`.** Every endpoint referenced below already exists there — do not invent request/response shapes; match the backend's zod schemas exactly (`/packs`, `/packs/:packId/categories|questions`, `/classes/mine`, `/classes/:id/pack`).
- **Follow the existing conventions exactly.** New screens use `Card`/`Table` markup/`Badge`/`Button`/`Banner`/`Loading`/`Empty`/`Field`/`Input`/`Select`/`ConfirmDialog` from `src/shared/components/ui.tsx` — never introduce a new UI primitive without checking that one doesn't already exist there.
- **API modules aren't unit tested in this codebase.** `endpoints.ts`, `types.ts`, and thin context/hook wrappers (`auth-context.tsx`, `use-directory.ts`) have no dedicated test files today — screens are tested by mocking `@/shared/api` wholesale (see `src/features/quiz/quiz-screen.test.tsx`). Follow this pattern: don't invent tests for API-client plumbing; do test new screens the way `quiz-screen.test.tsx` tests `QuizScreen`.
- **ESM/TS path alias:** imports use `@/...` (configured in `vite.config.ts`/`tsconfig.json`), matching every existing file.
- **Run `npm run typecheck && npm test` before every commit.**
- **Do not touch** `src/features/teachers/`, `src/features/students/`, `src/features/leaderboard/`, or `src/features/dashboard/` beyond what Task 3 requires (role-gating them in the nav) — their content stays admin-only and unchanged.

## File structure

**New:**
- `src/features/packs/packs-api-types.ts` — nothing; types go straight into `src/shared/api/types.ts` (existing convention — one shared types file, no per-feature type files)
- `src/features/packs/pack-list-screen.tsx` — the Packs library
- `src/features/packs/pack-list-screen.test.tsx`
- `src/features/classes/my-classes-screen.tsx` — a teacher's own classes + pack assignment
- `src/features/classes/my-classes-screen.test.tsx`
- `src/features/classes/assign-pack-dialog.tsx` — the share/copy dialog, its own component since both `pack-list-screen.tsx`'s "open in a class" flow (if added later) and `my-classes-screen.tsx` could reuse it, and because it's substantial enough (pack picker + mode choice + confirmation copy) to not inline in the screen

**Modified:**
- `src/shared/api/types.ts` — pack types, request/response shapes
- `src/shared/api/endpoints.ts` — `packsApi`, pack-scoped `contentApi`, `classesApi` additions
- `src/features/auth/auth-context.tsx` — accept `teacher` role
- `src/app/nav.ts` — `roles` field per `NavItem`, two new entries
- `src/app/layout.tsx` — filter `NAV` by role
- `src/features/quiz/quiz-screen.tsx` — take `packId` from the route, call pack-scoped `contentApi`
- `src/features/quiz/quiz-screen.test.tsx` — updated mocks/route for the new `packId` param
- `src/features/jigsaw/jigsaw-screen.tsx` — same retrofit
- `src/App.tsx` — new routes, role-based index redirect

---

### Task 1: Pack, class-assignment types and API client

**Files:**
- Modify: `src/shared/api/types.ts`, `src/shared/api/endpoints.ts`

**Interfaces:**
- Consumes: nothing new
- Produces:
  - Types: `ApiPackStatus = 'draft' | 'published' | 'archived'`, `ApiPackBinding = 'linked' | 'copied'`, `ApiPack`, `CreatePackRequest`, `PatchPackRequest`, `AssignPackRequest`
  - `packsApi.list(mine?: boolean): Promise<ApiPack[]>`
  - `packsApi.create(name: string): Promise<ApiPack>`
  - `packsApi.get(id: string): Promise<ApiPack>`
  - `packsApi.patch(id: string, input: Partial<PatchPackRequest>): Promise<ApiPack>`
  - `packsApi.duplicate(id: string, name?: string): Promise<ApiPack>`
  - `packsApi.publish(id: string): Promise<ApiPack>`
  - `packsApi.archive(id: string): Promise<ApiPack>`
  - `contentApi.categories(packId: string): Promise<ApiCategory[]>` — and every other `contentApi` method gains `packId: string` as its first parameter (see full list below)
  - `classesApi.mine(): Promise<ApiClass[]>`
  - `classesApi.assignPack(id: string, input: AssignPackRequest): Promise<ApiClass>`
  - `classesApi.clearPack(id: string): Promise<ApiClass>`
  - `ApiClass` gains `packId: string | null`, `packBinding: ApiPackBinding | null`, `packVersion: number | null`

- [ ] **Step 1: Add the pack types to `types.ts`**

Add near the `content` section (after `ApiContentSettings`, before `analytics`):

```ts
/* --------------------------------------------------------------------- packs */

export type ApiPackStatus = 'draft' | 'published' | 'archived';
export type ApiPackBinding = 'linked' | 'copied';

export interface ApiPack {
  id: string;
  name: string;
  ownerUid: string;
  origin: 'system' | 'teacher';
  forkedFrom: string | null;
  status: ApiPackStatus;
  version: number;
  publishedAt: string | null;
  showMiniLesson: boolean;
  classCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreatePackRequest {
  name: string;
}

export interface PatchPackRequest {
  name?: string;
  showMiniLesson?: boolean;
}

export interface AssignPackRequest {
  packId: string;
  mode: 'link' | 'copy';
}
```

Add `packId: string | null;`, `packBinding: ApiPackBinding | null;`, `packVersion: number | null;` to `ApiClass` right after `assignment`.

- [ ] **Step 2: Add `packsApi` to `endpoints.ts`**

Follow the exact style of `analyticsApi` (the shortest existing block) for imports/structure. Add after `contentApi`, before `analyticsApi`:

```ts
/* -------------------------------------------------------------------- packs */

export const packsApi = {
  list(mine = false): Promise<ApiPack[]> {
    return request<{ items: ApiPack[] }>('/packs', { query: { mine } }).then((r) => r.items);
  },

  create(name: string): Promise<ApiPack> {
    return request('/packs', { method: 'POST', body: { name } });
  },

  get(id: string): Promise<ApiPack> {
    return request(`/packs/${encodeURIComponent(id)}`);
  },

  patch(id: string, input: Partial<PatchPackRequest>): Promise<ApiPack> {
    return request(`/packs/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
  },

  duplicate(id: string, name?: string): Promise<ApiPack> {
    return request(`/packs/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
      body: name ? { name } : undefined,
    });
  },

  publish(id: string): Promise<ApiPack> {
    return request(`/packs/${encodeURIComponent(id)}/publish`, { method: 'POST' });
  },

  archive(id: string): Promise<ApiPack> {
    return request(`/packs/${encodeURIComponent(id)}/archive`, { method: 'POST' });
  },
};
```

Check `request`'s existing signature in `client.ts` for exactly how `query`/`body`/`method` are passed (match `classesApi`/`contentApi`'s calls above it in the same file) — if `query: { mine }` needs to be a string (`String(mine)`) rather than a boolean because of how query params are serialized elsewhere in this file, match whatever `usersApi.list`'s existing boolean-ish query handling does (see `classesApi.members`'s `includeRemoved` handling for the exact pattern this codebase uses for a boolean query param).

- [ ] **Step 3: Rewrite `contentApi` to take `packId`**

Every method's URL changes from `/content/...` to `/packs/${encodeURIComponent(packId)}/...`, and every method gains `packId: string` as its first parameter. Example transformation (apply the same pattern to `category`, `updateCategory`, `replaceJigsaws`, `questions`, `question`, `upsertQuestion`, `revertQuestion` — `settings`/`updateSettings` stay pointed at `/content/settings` unchanged, since settings are not part of this retrofit and the backend still serves them off the shim):

```ts
export const contentApi = {
  async categories(packId: string): Promise<ApiCategory[]> {
    const { items } = await request<{ items: ApiCategory[] }>(
      `/packs/${encodeURIComponent(packId)}/categories`,
    );
    return items;
  },
  // ...category(packId, key), updateCategory(packId, key, patch), replaceJigsaws(packId, key, items, slots, pieces),
  // questions(packId, query), question(packId, category, level, activityNum),
  // upsertQuestion(packId, category, level, activityNum, input), revertQuestion(packId, category, level, activityNum)
  // — each with packId as the new first parameter and its URL prefixed
  // `/packs/${encodeURIComponent(packId)}` in place of `/content`.

  settings(): Promise<ApiContentSettings> {
    return request('/content/settings');
  },
  updateSettings(showMiniLesson: boolean): Promise<ApiContentSettings> {
    return request('/content/settings', { method: 'PUT', body: { showMiniLesson } });
  },
};
```

- [ ] **Step 4: Add to `classesApi`**

```ts
  mine(): Promise<ApiClass[]> {
    return request<{ items: ApiClass[] }>('/classes/mine').then((r) => r.items);
  },

  assignPack(id: string, input: AssignPackRequest): Promise<ApiClass> {
    return request(`/classes/${encodeURIComponent(id)}/pack`, { method: 'PUT', body: input });
  },

  clearPack(id: string): Promise<ApiClass> {
    return request(`/classes/${encodeURIComponent(id)}/pack`, { method: 'DELETE' });
  },
```

Check the actual response shape of `GET /classes/mine` against `juanwise-be src/modules/classes/classes.routes.ts` before assuming `{ items: [...] }` — if it returns a bare array instead, adjust accordingly (the plan's own convention elsewhere in this file wraps list responses in `{ items }`, but verify this specific route rather than assuming).

- [ ] **Step 5: Update every call site broken by `contentApi`'s new signature**

Run `npm run typecheck` — it will point at every call site in `quiz-screen.tsx` and `jigsaw-screen.tsx` that now fails to compile because `contentApi.questions(...)` etc. are missing the new leading `packId` argument. Do NOT fix those call sites in this task — that's Tasks 5 and 6. For this task, it is expected and fine that `npm run typecheck` fails after this step; note that in your report. Do not attempt to make the whole project typecheck clean in this task.

- [ ] **Step 6: Commit**

```bash
git add src/shared/api/types.ts src/shared/api/endpoints.ts
git commit -m "feat: add pack and class-assignment API client"
```

---

### Task 2: Widen the login gate to accept teachers

**Files:**
- Modify: `src/features/auth/auth-context.tsx`

**Interfaces:**
- Consumes: `ApiCurrentUser.role` (existing)
- Produces: no new exported interface — `AuthContextValue` is unchanged in shape; `user.role` (already present) is what callers branch on

- [ ] **Step 1: Widen the role check in `signIn` and the restore effect**

Replace every `role === 'admin'` check in this file with `role === 'admin' || role === 'teacher'`, and update the rejection message:

```ts
const NOT_ADMIN =
  "That account isn't a JuanWise teacher or administrator account. Sign in with a teacher or admin account.";
```

Update the doc comment above `AuthContextValue` — it currently says "a teacher's or a student's credentials... have no business here"; correct it to say a teacher's credentials are now expected, only a student's are refused.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck` — this file alone should now be clean (the wider project failure from Task 1 Step 5 is expected and unrelated).

- [ ] **Step 3: Commit**

```bash
git add src/features/auth/auth-context.tsx
git commit -m "feat: let a teacher account sign into the console"
```

---

### Task 3: Role-aware navigation

**Files:**
- Modify: `src/app/nav.ts`, `src/app/layout.tsx`

**Interfaces:**
- Consumes: `useAuth().user.role` (Task 2)
- Produces: `NavItem.roles: ('admin' | 'teacher')[]`; `layout.tsx` filters `NAV` by it before rendering

- [ ] **Step 1: Add `roles` to every existing `NavItem` and two new entries**

In `nav.ts`, add `roles: ('admin' | 'teacher')[]` to the `NavItem` interface, and set it per the spec's table:

```ts
export const NAV: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: '🏠', title: 'Dashboard', subtitle: '...', section: 'Manage', roles: ['admin'] },
  { path: '/teachers', ..., roles: ['admin'] },
  { path: '/students', ..., roles: ['admin'] },
  { path: '/leaderboard', ..., roles: ['admin'] },
  {
    path: '/packs',
    label: 'Packs',
    icon: '📦',
    title: 'Content Packs',
    subtitle: 'Build, duplicate and publish the activities your classes play',
    section: 'Content',
    roles: ['admin', 'teacher'],
  },
  {
    path: '/my-classes',
    label: 'My Classes',
    icon: '🏫',
    title: 'My Classes',
    subtitle: 'The classes you handle, and which pack each one plays',
    section: 'Manage',
    roles: ['teacher'],
  },
  { path: '/quiz', ..., roles: ['admin', 'teacher'] },
  { path: '/jigsaw', ..., roles: ['admin', 'teacher'] },
];
```

Keep every existing field (`icon`, `title`, `subtitle`, `section`) exactly as it is today for the six pre-existing items — only add `roles`.

- [ ] **Step 2: Filter by role in `layout.tsx`**

In `AdminLayout`, after destructuring `user` from `useAuth()`, filter the nav list before it's used by the `sections.map(...)` render:

```ts
const visibleNav = NAV.filter((item) => user && item.roles.includes(user.role as 'admin' | 'teacher'));
```

Replace the `NAV.filter((item) => item.section === section)` call inside the render with `visibleNav.filter((item) => item.section === section)`.

`navForPath` (used for the topbar title) does not need to filter by role — a signed-in user only ever navigates to a path their own nav exposes, and `navForPath`'s job is just "what does this path's item say", not access control.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck` on these two files specifically if the whole-project check still fails from Task 1's expected partial state (`npx tsc --noEmit src/app/nav.ts src/app/layout.tsx` is not meaningful for a project-mode tsconfig — instead, just confirm no NEW errors appear in `nav.ts`/`layout.tsx` in the full `npm run typecheck` output compared to before this task's changes).

- [ ] **Step 4: Commit**

```bash
git add src/app/nav.ts src/app/layout.tsx
git commit -m "feat: filter the sidebar nav by the signed-in role"
```

---

### Task 4: Packs library screen

**Files:**
- Create: `src/features/packs/pack-list-screen.tsx`, `src/features/packs/pack-list-screen.test.tsx`

**Interfaces:**
- Consumes: `packsApi` (Task 1), `useAuth()` (existing), `useAsync` (existing, `src/shared/lib/use-async.ts`)
- Produces: `export default function PackListScreen()`, mounted later at `/packs` (Task 8)

Read `src/features/teachers/teachers-screen.tsx` in full first — it is the closest existing pattern for "a table of rows, each expandable/actionable, with a search box and a refresh button, backed by `useAsync`". Read `src/shared/components/ui.tsx`'s `ConfirmDialog` for the create/duplicate dialog pattern (`quiz-screen.tsx`'s `ConfirmDialog` usage for the type-change warning is a good reference for a simple named-input dialog, though you'll need a plain create-with-a-name-field form, not a confirm — check if `ui.tsx` has anything resembling a simple text-prompt modal; if not, a `<dialog>` element styled like `ConfirmDialog` with an `<Input>` inside its body is the right shape — follow `ConfirmDialog`'s own implementation as the template for building this one, since it's the only modal in the codebase).

- [ ] **Step 1: Build the screen**

Behavior to implement:
- On mount, load packs via `packsApi.list()` (default `mine=false`, so it returns the caller's own packs plus every published one, per the backend's `listPacksFor`).
- Render each pack as a row/card: name, a `Badge` for status (`draft` → default tone, `published` → green, `archived` → red — matching the tone vocabulary already used elsewhere, e.g. `TeachersScreen`'s archived-class badge), version, `classCount` (as "used by N class(es)" or "not in use"), and whether the signed-in user owns it (`pack.ownerUid === user.uid`) vs. it being someone else's published pack available to duplicate.
- A **"New pack"** button opens a small dialog asking for a name, calling `packsApi.create(name)` on confirm, then reloading the list and navigating to `/packs/:id/quiz` for the newly created pack (a fresh pack has nothing to jigsaw yet, but Quiz is the natural first stop — this is a judgment call, not a hard requirement; do what reads most naturally given the actual `PackListScreen` layout you build).
- Each pack owned by the user shows **Edit → Quiz** and **Edit → Jigsaw** links to `/packs/${pack.id}/quiz` and `/packs/${pack.id}/jigsaw` (use React Router's `Link`, matching `dashboard-screen.tsx`'s existing use of `Link`).
- Each pack (owned or not) shows a **"Duplicate"** action calling `packsApi.duplicate(pack.id)`, reloading the list on success.
- An owned pack shows **"Publish"** (only meaningfully actionable when there's something to publish — don't over-engineer a diff-detection; just always show it enabled for an owned draft, and hide it for an already-published pack with no further edits detectable client-side, since there's no unpublished-changes flag in `ApiPack` — showing it whenever `status === 'draft'` is sufficient) calling `packsApi.publish(pack.id)`.
- An owned pack shows **"Archive"** calling `packsApi.archive(pack.id)`; on a 409 (blocked because `classCount > 0`), show the error message the API returns via a `Banner` — do not hardcode a different message, the backend's `ConflictError` message already names the exact class count.
- Loading/error/empty states follow the exact pattern in `teachers-screen.tsx` (`Loading`, `Banner tone="error"` with a retry `Button`, `Empty` with an icon/title/hint).

- [ ] **Step 2: Write the test file**

Follow `quiz-screen.test.tsx`'s exact mocking pattern (`vi.mock('@/shared/api', ...)`, dynamic `await import('./pack-list-screen')` after the mock is set up). Cover at minimum:
- Renders a list of packs from a mocked `packsApi.list`.
- Creating a pack calls `packsApi.create` with the typed name.
- Publishing an owned draft pack calls `packsApi.publish` with its id.
- Archiving a pack that the API rejects with a 409 shows the returned error message in a `Banner`.

- [ ] **Step 3: Run tests**

Run: `npm test -- pack-list-screen` and `npm run typecheck` — this file's own types should be clean (project-wide typecheck may still show the Task-1-Step-5 expected failures in `quiz-screen.tsx`/`jigsaw-screen.tsx` until Tasks 5–6 land; confirm no NEW failures in files this task touches).

- [ ] **Step 4: Commit**

```bash
git add src/features/packs/
git commit -m "feat: add the content-pack library screen"
```

---

### Task 5: Retrofit Quiz screen to a specific pack

**Files:**
- Modify: `src/features/quiz/quiz-screen.tsx`, `src/features/quiz/quiz-screen.test.tsx`

**Interfaces:**
- Consumes: `useParams()` from `react-router-dom` for `packId`; `contentApi` (Task 1's new pack-scoped signatures)
- Produces: `QuizScreen` reads `packId` from the route instead of implicitly hitting `/content/*`

- [ ] **Step 1: Take `packId` from the route**

At the top of `QuizScreen`, add:
```ts
import { useParams } from 'react-router-dom';
// ...
const { packId } = useParams<{ packId: string }>();
```
This screen will only ever be mounted under a route that supplies `:packId` (Task 8), so `packId` is guaranteed present at runtime — but it's typed `string | undefined` by `useParams`. Handle the type narrowing the way the rest of this codebase does it (check `question-editor.tsx`-style param handling elsewhere in this codebase, or simply: if `!packId`, render nothing/a `Banner tone="error"` saying the pack could not be identified, rather than asserting non-null — this is a real defensive case worth a two-line guard, not a type-cast).

- [ ] **Step 2: Thread `packId` through every `contentApi` call**

`questions.reload`/`useAsync(() => contentApi.questions(packId, { category, level }), [packId, category, level])`, and every other `contentApi.*` call in `QuestionEditor` (`upsertQuestion`, `revertQuestion`) gains `packId` as its new first argument, sourced from the prop passed down from `QuizScreen` (thread `packId` as a new prop to `QuestionEditor`, alongside `category`/`level`/`activityNum`).

`mediaApi.upload(file, 'question-image', { categoryKey: category })` is UNCHANGED — the media upload path does not take a `packId` (the backend's media module was not retrofitted to be pack-aware; uploads remain identified only by `categoryKey`, per the parent spec's "storage prefix reorganisation" being explicitly deferred).

- [ ] **Step 3: Add a pack-name header**

`QuizScreen`'s outer `Card` (or a small banner above it) should show which pack is being edited — fetch it via `packsApi.get(packId)` in a small `useAsync` and show its `name` somewhere in the existing "Choose an activity" card's title/hint, e.g. `title="Choose an activity"` stays, but add the pack name to the `hint` text: `` `Editing "${pack?.name ?? '…'}" — every category has 5 levels of 6 activities.` ``. Keep this minimal — do not build a pack switcher on this screen; navigating to a different pack happens by going back to `/packs`.

- [ ] **Step 4: Update the test file**

`quiz-screen.test.tsx` renders `<QuizScreen />` directly with no router context today — since the screen now calls `useParams()`, it must be rendered inside a `MemoryRouter` (or `createMemoryRouter`/`RouterProvider`, matching whatever pattern `react-router-dom` v7 testing idiom this codebase would use — check if any other test in this repo already wraps a component needing router context; if none do, use `MemoryRouter` with an initial entry like `/packs/pk_test/quiz` and a `<Route path="/packs/:packId/quiz" element={<QuizScreen />} />` wrapper, the standard React Router testing pattern). Update the mock for `contentApi.questions`/`upsertQuestion`/`revertQuestion` to expect the new leading `packId` argument in any assertion that checks call arguments. Add `packsApi.get` to the `vi.mock('@/shared/api', ...)` block, mocked to resolve a fake pack (`{ id: 'pk_test', name: 'Test Pack', ... }`) so the new pack-name header doesn't break existing assertions.

- [ ] **Step 5: Run tests**

Run: `npm test -- quiz-screen` and `npm run typecheck` — `quiz-screen.tsx` should now typecheck cleanly.

- [ ] **Step 6: Commit**

```bash
git add src/features/quiz/
git commit -m "feat: scope the quiz editor to a specific content pack"
```

---

### Task 6: Retrofit Jigsaw screen to a specific pack

**Files:**
- Modify: `src/features/jigsaw/jigsaw-screen.tsx`

**Interfaces:**
- Consumes: same as Task 5 — `useParams()`, pack-scoped `contentApi`
- Produces: `JigsawScreen` reads `packId` from the route

- [ ] **Step 1: Read `jigsaw-screen.tsx` in full first**

It's 797 lines — read the whole file before editing. It is structurally the sibling of `quiz-screen.tsx` (same `useAsync`/`contentApi` shape, just editing categories/jigsaw pictures instead of questions), so apply the identical retrofit pattern from Task 5: take `packId` from `useParams()`, thread it as the new first argument into every `contentApi.categories`/`contentApi.category`/`contentApi.updateCategory`/`contentApi.replaceJigsaws` call in the file, and add the same pack-name context to whichever top-level `Card` in this screen plays the role `QuizScreen`'s "Choose an activity" card does.

`mediaApi.upload(square, 'category-image', {...})` stays unchanged, same reasoning as Task 5 Step 2.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck` — should now be clean project-wide (this is the last file blocking it from Task 1 Step 5's expected temporary breakage).

- [ ] **Step 3: Run existing tests**

Run: `npm test` — the full suite, including `jigsaw-layout.test.mjs`, should pass unchanged (that file tests `jigsaw-shapes.ts`'s pure grid math, unrelated to this retrofit).

- [ ] **Step 4: Commit**

```bash
git add src/features/jigsaw/
git commit -m "feat: scope the jigsaw editor to a specific content pack"
```

---

### Task 7: My Classes screen and the assign-pack dialog

**Files:**
- Create: `src/features/classes/my-classes-screen.tsx`, `src/features/classes/my-classes-screen.test.tsx`, `src/features/classes/assign-pack-dialog.tsx`

**Interfaces:**
- Consumes: `classesApi.mine/assignPack/clearPack`, `packsApi.list` (Task 1), `useAuth()`
- Produces: `export default function MyClassesScreen()`, `export function AssignPackDialog(props): JSX.Element`, mounted at `/my-classes` (Task 8)

- [ ] **Step 1: Build `AssignPackDialog`**

Props: `{ open: boolean; classes: ApiClass[]; currentClass: ApiClass; packs: ApiPack[]; onAssign: (input: AssignPackRequest) => Promise<void>; onClose: () => void }`.

Behavior, matching the walkthrough's "share or copy" screen:
- A list/select of packs the teacher can choose from (their own + published ones from `packs`).
- Once a pack is picked, if any OTHER class in `classes` (excluding `currentClass`) already has that same `packId`, show the sharing consequence inline: *"This pack is already used by N other class(es). Sharing it here would mean M learners across N+1 classes see the same activities."* — compute the affected-learner count by summing `memberCount` across every class in `classes` that would end up on this `packId` after the assignment (including `currentClass`'s own `memberCount`).
- Two buttons: **"Share it"** (`mode: 'link'`) and **"Make a copy"** (`mode: 'copy'`), matching the walkthrough's copy — "Share it" is visually the recommended/primary action (matches `AssignPackRequest`'s server-side default of `'link'`, though the client should send `mode` explicitly rather than relying on the server default, so the UI's own recommendation and what's actually sent never drift apart).
- Calls `onAssign({ packId: <chosen>, mode: <chosen> })` and closes on success; shows a `Banner tone="error"` on failure without closing.

Build this as a `<dialog>`-based component following `ConfirmDialog`'s exact implementation in `ui.tsx` as the template (same open/close/backdrop mechanics), since it's the only existing modal in this codebase and this new dialog needs the same mechanics with different content.

- [ ] **Step 2: Build `MyClassesScreen`**

- Load `classesApi.mine()` and `packsApi.list()` together (mirror `useDirectory`'s `Promise.all` pattern, but scoped — this doesn't need its own hook file since it's used by exactly one screen; a local `useAsync` with a `Promise.all` inside is enough, following `dashboard-screen.tsx`-style directness rather than introducing a new shared hook for one consumer).
- Render each of the teacher's classes as a row: name, code (`Badge tone="code"`, matching `teachers-screen.tsx`), member count, its current pack's name and binding (look up the pack from the loaded `packsApi.list()` result by `class.packId`; if `class.packId` is null, show "No pack assigned — playing the starter set" — matching the spec's fallback-to-system-pack behavior), and an **"Assign a pack"** / **"Change pack"** button opening `AssignPackDialog` for that class.
- A class with a pack assigned also shows a **"Clear"** action calling `classesApi.clearPack(class.id)`.
- Loading/error/empty states follow `teachers-screen.tsx`'s pattern again.

- [ ] **Step 3: Write the test file**

Cover: renders the teacher's classes with their pack names; opening the assign dialog and choosing "Share it" calls `classesApi.assignPack` with `mode: 'link'`; choosing "Make a copy" calls it with `mode: 'copy'`; clearing a pack calls `classesApi.clearPack`.

- [ ] **Step 4: Run tests**

Run: `npm test -- my-classes-screen` and `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/features/classes/
git commit -m "feat: add the My Classes screen with pack assignment"
```

---

### Task 8: Wire up routing

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `PackListScreen` (Task 4), retrofitted `QuizScreen`/`JigsawScreen` (Tasks 5–6), `MyClassesScreen` (Task 7)
- Produces: the complete route table

- [ ] **Step 1: Add the new routes and role-based index redirect**

```tsx
import PackListScreen from '@/features/packs/pack-list-screen';
import MyClassesScreen from '@/features/classes/my-classes-screen';
```

Replace the fixed `<Route index element={<DashboardScreen />} />` with a role-aware element (a small inline component or ternary is fine — this codebase does not have a pattern for this yet, so introduce the simplest thing that works):

```tsx
<Route index element={user.role === 'admin' ? <DashboardScreen /> : <Navigate to="/packs" replace />} />
```

(`user` is already in scope inside `Gate()` — reuse it rather than calling `useAuth()` again.)

Change `/quiz` and `/jigsaw` to take a `packId` param, and add `/packs` and `/my-classes`:

```tsx
<Route path="/packs" element={<PackListScreen />} />
<Route path="/my-classes" element={<MyClassesScreen />} />
<Route path="/packs/:packId/quiz" element={<QuizScreen />} />
<Route path="/packs/:packId/jigsaw" element={<JigsawScreen />} />
```

Remove the old flat `/quiz` and `/jigsaw` routes entirely — every entry point into these screens now goes through `PackListScreen`'s links, which always carry a `packId`. Do not keep a redirect from the old paths; there is no external bookmark or deep link into this internal console that needs preserving (unlike the backend's `/content/*` shim, which protects an external mobile client — this is purely internal admin-console navigation).

- [ ] **Step 2: Run the full suite**

Run: `npm run typecheck && npm test` — both must be fully clean now, project-wide.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: route pack-scoped screens and gate the dashboard by role"
```

---

## Self-review

**Spec coverage.** Decision 1 (one app, role-based views) → Tasks 2, 3, 8. Decision 2 (pack-scoped content everywhere) → Tasks 1, 5, 6. Packs feature → Task 4. Class assignment (link-or-copy) → Task 7. Out-of-scope items (teacher's own leaderboard, admin assigning on another teacher's behalf, co-owned packs) are explicitly not built by any task, matching the spec.

**Not covered, deliberately.** A teacher-scoped Dashboard (spec explicitly defers this — Dashboard stays admin-only). Visual redesign beyond adding the two new screens using existing components.

**Type consistency check.** `ApiPack`/`AssignPackRequest`/`ApiPackBinding` (Task 1) are consumed identically by Tasks 4 and 7. `contentApi`'s new `packId`-first signature (Task 1) is consumed identically by Tasks 5 and 6. `packId` from `useParams()` is threaded the same way in both Task 5 and Task 6.

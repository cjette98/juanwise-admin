# Teacher Access to Content Packs — Web Console Design

**Date:** 2026-09-08
**Repo:** `juanwise-admin`
**Depends on:** `juanwise-be` branch `feat/content-packs` (PR: teacher-owned content packs) — this plan assumes that API surface exists.
**Parent spec:** `../../../juanwise-be/docs/superpowers/specs/2026-09-08-content-packs-design.md`

## Problem

`juanwise-admin` today is a super-admin-only console: `auth-context.tsx`'s `signIn` rejects any non-`admin` login with a 403 and logs the account out server-side. The backend now lets a teacher own content packs and administer the classes they handle, but nothing on web lets a teacher act on that — they can only do it from the mobile app's `(admin)` route group. The ask: give teachers the same pack-authoring and class-assignment capability on web that mobile has, without opening up the screens that are legitimately org-wide (Teachers, Students, the cross-class Leaderboard).

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Auth model | **One app, role-based views.** Widen the login gate to accept `teacher` as well as `admin`. A teacher sees a smaller nav (Packs, their own classes) with no Teachers/Students/global-Leaderboard. |
| 2 | Content scope | **Pack-scoped everywhere.** Quiz and Jigsaw screens are retrofitted to read/write a specific `packId` rather than the flat `/content/*` shim. An admin keeps editing by opening the system pack (`system-default`) through the same screens — no separate "admin mode" UI. |

## What changes

### Auth (`src/features/auth/auth-context.tsx`)

- `signIn` and the `/auth/me` restore check accept `role === 'admin' || role === 'teacher'`.
- `AuthContextValue` gains nothing new structurally — `user.role` already exists on `ApiCurrentUser` — but every screen and the nav now branches on it.
- Error copy changes from "administrator" language to something that covers both, e.g. *"That account isn't a JuanWise teacher or administrator account."*

### Navigation (`src/app/nav.ts`, `src/app/layout.tsx`)

`NavItem` gains `roles: ('admin' | 'teacher')[]`. Existing items:

| Item | Roles |
|---|---|
| Dashboard | admin only — it aggregates `useDirectory()`, which calls `GET /users` and `GET /classes`, both admin-only on the backend. A teacher-scoped dashboard is out of scope for this pass; mobile's teacher dashboard already covers that ground. |
| Teachers | admin only |
| Students | admin only |
| Leaderboard | admin only (cross-class); a teacher's own class leaderboard is out of scope for this pass — mobile already has it |
| Packs *(new)* | admin, teacher |
| My Classes *(new)* | teacher only — a teacher's own classes and pack assignment |
| Quiz | admin, teacher |
| Jigsaw | admin, teacher |

`AdminLayout` filters `NAV` by the signed-in user's role before rendering. A teacher's landing route (`/`) redirects to `/packs` rather than rendering `DashboardScreen`.

### Packs feature (`src/features/packs/`, new)

A pack library screen:

- Lists the caller's own packs plus every `published` pack (`GET /packs`), each showing name, status, version, and which classes use it (`classCount`).
- **Create** (`POST /packs`) — name only, starts as an empty draft.
- **Duplicate** (`POST /packs/:id/duplicate`) — from any pack the caller can read.
- **Publish** (`POST /packs/:id/publish`) — owner only, shown when the pack has unpublished changes.
- **Archive** (`POST /packs/:id/archive`) — owner only; the API 409s while any class still uses it, and that message is shown as-is.
- Selecting a pack opens Quiz or Jigsaw scoped to it (see below).

An admin sees every published pack across every teacher, useful for support/oversight, but the create/duplicate/assign flow is identical for both roles — only the *set* of packs listed differs (an admin's `mine=true` view is effectively empty unless they own packs themselves).

### Quiz and Jigsaw retrofit (`src/features/quiz/`, `src/features/jigsaw/`)

Both screens gain a required `packId`, arriving via route (`/packs/:packId/quiz`, `/packs/:packId/jigsaw`) rather than a top-level nav item that guesses one. Every `contentApi` call each screen makes moves from the `/content/*` shim to the pack-scoped equivalents:

| Old | New |
|---|---|
| `GET /content/categories` | `GET /packs/:packId/categories` |
| `GET /content/categories/:key` | `GET /packs/:packId/categories/:key` |
| `PUT /content/categories/:key` | `PUT /packs/:packId/categories/:key` |
| `GET/PUT /content/categories/:key/jigsaws` | `GET/PUT /packs/:packId/categories/:key/jigsaws` |
| `GET /content/questions` | `GET /packs/:packId/questions` |
| `GET/PUT/DELETE /content/questions/:cat/:lvl/:num` | same, under `/packs/:packId/...` |

The system pack keeps a fixed, well-known id (`system-default`), so a `/packs/system-default/quiz` route is exactly today's admin experience — nothing about the editor UI itself changes, only which pack it targets. `content.schema.ts`'s response/request shapes on the backend are unchanged (verified: the pack-scoped routes reuse the same schemas as `/content/*`), so no client type changes are needed beyond adding `packId` to each call's URL.

The Packs screen's card links straight to `/packs/:id/quiz` and `/packs/:id/jigsaw` — a teacher never has to know a URL, they click into their pack.

### Class assignment (`src/features/classes/`, new — or folded into a "My Classes" teacher view)

A teacher needs a way to see the classes they handle and assign a pack to each, mirroring the walkthrough's "share or copy" dialog:

- `GET /classes/mine` — lists the teacher's own classes (already exists on the backend; not yet wrapped in `classesApi`).
- Each class shows its current pack (if any) and a memberCount-derived "shared with N other classes" hint, computed client-side by counting how many of the teacher's own classes share the same `packId`.
- **Assign** opens a dialog: pick a pack (own or published), choose **Share it** (`mode: 'link'`, default) or **Make a copy** (`mode: 'copy'`), confirm via `PUT /classes/:id/pack`.
- **Clear** (`DELETE /classes/:id/pack`) removes the assignment, falling back to the system pack.

An admin does not get this screen in this pass — `TeachersScreen`'s existing per-teacher class list is enough for oversight, and assigning content on another teacher's behalf is out of scope (the design's decision 1 makes packs single-owner; an admin can act as any teacher's `assignPack` caller via the API's admin bypass, but that UI is deferred).

### API client additions (`src/shared/api/`)

New types in `types.ts`: `ApiPack`, `ApiPackStatus`, `ApiPackBinding`, `CreatePackRequest`, `PatchPackRequest`, `AssignPackRequest`.

New `packsApi` in `endpoints.ts`: `list(mine?)`, `create(name)`, `get(id)`, `patch(id, input)`, `duplicate(id, name?)`, `publish(id)`, `archive(id)`.

`contentApi` in `endpoints.ts`: every method gains a leading `packId: string` parameter, and every URL gains a `/packs/${packId}` prefix in place of `/content`. (This is a breaking change to `contentApi`'s own signatures — every call site in `quiz-screen.tsx`/`jigsaw-screen.tsx` updates in the same pass.)

`classesApi`: add `mine()` (`GET /classes/mine`), `assignPack(id, input)` (`PUT /classes/:id/pack`), `clearPack(id)` (`DELETE /classes/:id/pack`).

## Out of scope for this pass

- A teacher's own class leaderboard on web (mobile already has it).
- An admin assigning a pack on another teacher's behalf through the UI.
- Co-owned packs (matches the backend's decision — single owner).
- Any visual redesign beyond what's needed to add role-awareness to the nav and the new Packs/class-assignment screens; new screens follow the existing `Card`/`Table`/`Badge`/`Button` component vocabulary already in `src/shared/components/ui.tsx`.

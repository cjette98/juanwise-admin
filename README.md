# JuanWise Admin

The console the JuanWise main admin signs into: the teacher and student
directory, the leaderboards, and the quiz and jigsaw content every player sees.

It is a browser app (Vite + React + TypeScript) that talks to the same API as
the game — `juanwise-be` — with the same tokens and the same rules. It stores
nothing of its own.

```
juanwise-app-main/
├── juanwise-app-v2/   the Expo game
├── juanwise-be/       the API both clients talk to
└── juanwise-admin/    ← this console
```

## Running it

```bash
npm install
npm run dev          # http://localhost:5180
```

By default it talks to the deployed API at `https://juanwise-be.vercel.app`.
To run against a backend on your laptop, copy `.env.example` to `.env` and set:

```
VITE_API_URL=http://localhost:3000
```

The API allows every origin by default (`CORS_ORIGINS=*` in juanwise-be), so a
local backend needs no extra configuration.

```bash
npm run build        # typecheck + production bundle into dist/
npm run typecheck
```

## Signing in

Only accounts with the **admin** role get in. A teacher's or a student's
credentials are valid at `POST /auth/login` — the console signs them straight
back out with an explanation, because every screen here needs the admin claim.

Grant the claim from juanwise-be:

```bash
cd ../juanwise-be
npm run grant-admin -- <username-or-email>
```

The role is re-checked against `/auth/me` on every cold start, so revoking the
claim locks the console on the next reload rather than at the end of the hour
the stored token has left.

## What each screen does

| Screen | Reads | Writes |
|---|---|---|
| **Dashboard** | counts of teachers, students, classes and guests | — |
| **Teachers** | `GET /users?role=teacher` + `GET /classes`; expand a row for that teacher's classes, codes and current assignment | — |
| **Students** | `GET /users?role=student`, resolved through the class to show the **teacher** and the **class code** they joined | — |
| **Leaderboard** | two boards, see below | — |
| **Quiz** | `GET /content/questions` — every slot in the 6 categories × 5 levels × 6 activities grid | `PUT`/`DELETE /content/questions/:category/:level/:activityNum` |
| **Jigsaw** | `GET /content/categories` | `PUT /content/categories/:key`, `POST /media/upload-url` |

### The two leaderboards

JuanWise has two kinds of player, and they cannot be ranked on one list:

- **Guests** — registered, but in no class. There is no roster to rank them
  against, so they are ranked against each other deployment-wide by
  `GET /analytics/leaderboard/guests`. A guest who later joins a class drops off
  this board even though the results they earned as a guest still exist.
- **Assigned classes** — every teacher, each of their classes, and the top 10 of
  each. Each class is its own ranking; two classes are never mixed.

Both boards can be narrowed to one category and to quiz-only or jigsaw-only.

### Quiz authoring

`GET /content/questions` returns every slot in the grid, so an activity nobody
has authored comes back with the game's built-in question and
`isOverride: false` — marked **Default** in the picker. Saving stores an
override that reaches every player; **Revert to default** deletes it.

Multiple choice and enumeration are the two types the API stores. The editor
enforces the same rules the server does (2–8 choices, the correct answer must be
one of them; an enumeration pool of at least 10) so a save is not spent on a 422.

### Jigsaw authoring

A category has **30 jigsaw activities** (5 levels × 6), so one picture per
category meant a student solved the same image thirty times. Each activity is
now given its own picture, by hand.

The grid *is* the screen: 5 levels down, 6 activities across, each cell showing
its picture or "Not set". "Which picture does Level 3 Activity 4 play" is the
only question this page exists to answer, so it is answerable at a glance rather
than by clicking through levels.

Clicking an activity opens it. Adding a picture is **crop → write → save**:
choose the square, then write what the picture teaches, then save once. The
lesson is the point of the activity, so an upload flow that ended before it
would invite pictures with nothing to teach.

Each picture carries its own:

- **name** — the caption on the completed-puzzle reveal;
- **definition** (English and Tagalog) — one line, shown with the finished picture;
- **mini-lesson** (English and Tagalog) — shown to the student **the moment they
  finish that puzzle**, on the reveal card, scrolling inside it if long.

You can also reuse a picture already uploaded to that category instead of
uploading again.

Two different retreats, both in the activity's header:

- **Clear** frees this activity only. The picture stays in the category and can
  be assigned again from the reuse list.
- **Delete picture** removes the picture from the category altogether. Every
  activity assigned to it is unassigned in the same save — you are told how many
  before it happens — and each falls back to the category picture. The uploaded
  file itself stays in Cloud Storage; nothing points at it any more.

Uploading and assigning are separate underneath: pictures belong to the
category, a slot points at one. That is invisible in the common case, but means
the same picture can serve several activities without being uploaded twice.

An unassigned activity is **not** broken — it falls back to the category
picture, and below that to the image the game ships with. Assign the activities
that matter and leave the rest; there is no obligation to fill all 30.

### How many pieces

Each activity is also given its own cut — **6, 9 or 12 pieces** — in the
**Pieces** picker at the top of the activity's form. The preview re-cuts as you
change it, and it is written by the same **Save** as the rest of the form, so
one trip through the editor is one save. The number on every cell in the grid
shows what that activity plays: grey while it follows the default, blue once you
have chosen.

The cut belongs to the activity, not to the picture, so one picture reused
across three activities can be an easy board in one and a hard one in another —
and an activity with no picture of its own still has a cut, because it still
plays, on the category fallback.

**Default** is not the same as 6. An activity left on Default follows the game's
ramp across a level's six activities — 1–2 are 6 pieces, 3–4 are 9, 5–6 are 12 —
so choosing it back later restores the ramp rather than pinning the activity to
whatever the ramp says today.

The board is square and most pictures are not, so choosing a file opens a
cropper rather than uploading straight away. **Fill square** covers the board and
cuts the rest — drag to choose which part survives, zoom to change how much fits.
**Fit whole picture** keeps everything and fills the leftover space with a
blurred copy of the image, so the outer puzzle pieces are not blank. Either way
the file that gets uploaded is already a 1024×1024 square, so nothing downstream
crops it and the preview cannot disagree with the game.

The preview cuts the picture with `jigsaw-shapes.ts`, which is a copy of the
game's own generator — the same tabs, blanks and grids (6 → 2×3, 9 → 3×3,
12 → 3×4) — so what you see is the cut a player gets. **If you change one copy,
change both.**

A category with no uploaded picture is not broken: the game falls back to its
bundled image, and the preview shows that same fallback.

## Troubleshooting

**"The browser could not upload to Cloud Storage"** when setting a jigsaw
picture — the storage bucket has no CORS rule for this origin. The API call
succeeded; the blocked leg is the browser's PUT straight to Cloud Storage, which
React Native never had to deal with because its fetch does not enforce CORS.
Fix it once, in juanwise-be:

```bash
cd ../juanwise-be
npm run storage-cors                          # applies storage.cors.json
npm run storage-cors -- https://your-console  # for a deployed console
npm run check-storage                         # verify the whole upload path
```

**The picture uploads but shows as broken.** The object was stored without
`x-goog-acl: public-read`, so it 403s on read. That header comes back from
`POST /media/upload-url` as `requiredHeaders` and is sent on the PUT — so this
means the API is older than that change. Redeploy juanwise-be.

## Layout

```
src/
├── app/           sidebar shell + the nav that titles every page
├── features/
│   ├── auth/      the admin gate: login screen + session context
│   ├── directory/ teachers + students + classes in one load, with the lookups
│   ├── dashboard/ teachers/ students/ leaderboard/ quiz/ jigsaw/
└── shared/
    ├── api/       client, session, endpoints, wire types
    ├── assets/    logo and pictures copied from juanwise-app-v2
    ├── components/ the console's primitives
    ├── lib/       formatting + the useAsync hook every screen loads through
    └── theme/     colors.ts, copied from the game
```

`shared/api` is a port of juanwise-app-v2 `src/shared/api`: same error envelope,
same single-flight token refresh, same replay-once-on-401. The differences are
the storage (`localStorage`, which is synchronous, instead of AsyncStorage) and
uploads (a browser hands over a `File`; the app hands over a `file://` URI).

## What this console needed from the API

Three additions to juanwise-be, all admin-only:

- `GET /classes` — the cross-teacher view. `GET /classes/mine` is scoped to the
  caller, which is right for a teacher and useless for an admin.
- `GET /analytics/leaderboard/guests` — the class leaderboard requires a
  `classId`, and a guest has none.
- `definition_en` / `definition_tl` on a category — the one-line summary shown on
  the game's jigsaw reveal.

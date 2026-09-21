# TaskBuddy

TaskBuddy pulls students and tasks from a course GitLab project and recommends issues to each
student so that everyone reaches the minimum participation percentage the instructor sets.

- **Students** are the members of the GitLab project (access level Developer or above).
  Maintainers and owners are treated as instructors.
- **Tasks** are the project's GitLab issues. TaskBuddy categorizes each one itself
  (frontend, backend, security, ...); students never label a task.
- **Participation** for a student is `issues assigned to them / total issues`.
- **Recommendations** fill the gap between where a student is and the required minimum,
  preferring issues that match the skills the student entered.

## Quick start

```bash
npm install
cp .env.example .env
npx prisma db push
npm run dev
```

Open http://localhost:3000. With no GitLab credentials configured the app starts in **demo mode**:
it seeds a fixture class and lets you pick a student to sign in as, so you can try the whole flow
without a GitLab project.

## Connecting a real GitLab project

Create an OAuth application in GitLab (**User settings → Applications**) with the `api` scope and
the redirect URI `http://localhost:3000/api/auth/gitlab/callback`, then fill in `.env`:

| Variable | Meaning |
| --- | --- |
| `GITLAB_URL` | GitLab instance, defaults to `https://gitlab.com` |
| `GITLAB_PROJECT_ID` | Numeric id or URL-encoded path of the course project |
| `GITLAB_APP_ID` / `GITLAB_APP_SECRET` | OAuth application credentials |
| `APP_URL` | Base URL used to build the OAuth redirect, e.g. `http://localhost:3000` |
| `DEMO_MODE` | `true` forces fixtures, `false` forces GitLab; unset auto-detects |

Sign in with GitLab and TaskBuddy syncs the project's members and issues. Pressing **Sync from
GitLab** on the dashboard refreshes them. The `api` scope is needed because claiming an issue
writes the assignee back to GitLab.

## How tasks are categorized

Every task is placed into up to three categories out of a fixed taxonomy: `frontend`, `backend`,
`database`, `security`, `testing`, `devops`, `docs`, `design`, `performance`, `accessibility`.
Nobody assigns these by hand. The categorizer reads the issue's labels, title, and description and
scores each category: **+3** for a label that means the category (`a11y` counts as
`accessibility`, `ci` as `devops`), **+2** for a keyword in the title, **+1** for one in the
description. Categories below the score or confidence threshold are dropped, so an issue whose text
says nothing useful stays uncategorized rather than being guessed at. Each category keeps the terms
that produced it, which is what the tooltip on a category chip shows.

Categorization runs inside `upsertIssues`, the single path every sync and seed goes through, so it
needs no separate step. A hash of the classified text is stored alongside the result, so re-syncing
only reclassifies issues whose wording actually changed. Instructors can force a full pass with
**Re-run categorization** on the class page.

The classifier lives behind the `TaskCategorizer` interface in `src/lib/ai/categorize.ts`, which is
batched and asynchronous. The bundled implementation is a deterministic keyword model that needs no
credentials and no network; swapping in a model-backed one means implementing that interface and
branching in `getCategorizer()` in `src/lib/ai/index.ts`. Nothing else changes, because every
caller goes through that function.

## How recommendations are produced

1. The pool is every issue that is open and has no assignee, so work someone already owns is never
   reassigned.
2. Each `(student, issue)` pair is scored: +3 per exact match between one of the student's skills
   and one of the issue's labels, +2 per assigned category the student's skills cover, +1 per skill
   that appears in the title or description. A skill that already earned label points is not paid
   again by a category of the same name.
3. A greedy pass repeatedly serves the student with the largest remaining need, giving them the
   highest-scoring issue left in the pool. Ties break deterministically on current issue count,
   then username, then issue id.
4. Students who entered no skills still receive quota fills, so participation is reachable for
   everyone as long as issues remain.

If the class cannot reach the target because there are too few unassigned issues, the plan is
marked infeasible, the instructor view explains how many issues are missing, and the available
issues are still spread as evenly as possible.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Sign in with GitLab, or pick a student in demo mode |
| `/dashboard` | NotebookLM-style board: skills, Class/Teacher chat under skills, categorized recommendations, claimed issues |
| `/profile` | Edit the skills and interests a student provides |
| `/shared` | Files students share with the class |
| `/bureaucracy` | Official course documents; the instructor uploads, students download |
| `/class` | Instructor only: set the minimum percentage, recategorize tasks, review the whole class |

## Development

```bash
npm test          # unit tests for participation, recommender, and the task categorizer
npm run build     # generates the Prisma client, then builds Next.js
npm run db:seed   # reset the demo class fixtures
```

The recommender in `src/lib/recommender/` and the participation math in
`src/lib/participation.ts` are pure functions with no database or network access, which is what
keeps them unit-testable.

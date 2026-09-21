# TaskBuddy

TaskBuddy pulls students and tasks from a course GitLab project and recommends issues to each
student so that everyone reaches the minimum participation percentage the instructor sets.

- **Students** are the members of the GitLab project (access level Developer or above).
  Maintainers and owners are treated as instructors.
- **Tasks** are the project's GitLab issues; their labels drive skill matching.
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

## How recommendations are produced

1. The pool is every issue that is open and has no assignee, so work someone already owns is never
   reassigned.
2. Each `(student, issue)` pair is scored: +3 per exact match between one of the student's skills
   and one of the issue's labels, +1 per skill that appears in the title or description.
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
| `/dashboard` | NotebookLM-style board: skills, Class/Teacher chat under skills, recommendations, claimed issues |
| `/profile` | Edit the skills and interests a student provides |
| `/shared` | Files students share with the class |
| `/bureaucracy` | Official course documents; the instructor uploads, students download |
| `/class` | Instructor only: set the minimum percentage, review the whole class |

## Development

```bash
npm test          # unit tests for the participation math and recommender
npm run build     # generates the Prisma client, then builds Next.js
npm run db:seed   # reset the demo class fixtures
```

The recommender in `src/lib/recommender/` and the participation math in
`src/lib/participation.ts` are pure functions with no database or network access, which is what
keeps them unit-testable.

# TaskBuddy

A platform for student project work. Students sign in with their GitLab
account, declare their stack and how much time they have, and get a ranked feed
of GitLab issues that actually fit. Project teams then get a workspace with
chat and shared documents to do the work in.

Three things in one app:

1. **Task matching** — indexes issues from a GitLab instance and ranks them
   against each student's skills, interests and weekly time budget. Every
   suggestion explains itself.
2. **Chat** — project channels, direct messages and group chats, with
   attachments, mentions and full-text search. Suggests relevant tasks from
   what a conversation is actually about.
3. **Workspace documents** — report and project-plan sections a team edits
   together, with autosave, version history and section presence.

## Requirements

- Node.js 22 or newer
- pnpm 10
- PostgreSQL 16 (Docker Compose provides it, or use a local install)

## Running it

```bash
pnpm install
cp .env.example .env          # then generate the secrets, see below
docker compose up -d          # Postgres on :5432
pnpm db:migrate               # apply the schema
pnpm db:seed                  # demo students, projects, issues, chat, docs
pnpm dev                      # web :3000, realtime :3001, worker
```

Then open http://localhost:3000.

Generate the two secrets `.env` needs:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY
```

### No Docker?

Postgres can be installed directly instead:

```bash
sudo apt-get install -y postgresql
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE ROLE studentproj LOGIN PASSWORD 'studentproj' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE studentproj OWNER studentproj;"
```

## Signing in

With `ALLOW_DEV_LOGIN=true` the sign-in page lists the seeded demo students and
signs you in as one of them with no password. That exists so the app is usable
before you have registered an OAuth application, and it is refused outright
when `NODE_ENV=production`.

For real GitLab sign-in, register an OAuth application on your instance
(admin **Applications**, or your own user settings for a personal one) with:

- Redirect URI: `http://localhost:3000/api/auth/callback/gitlab`
- Scopes: `openid`, `profile`, `email`, `read_api`

then set `GITLAB_BASE_URL`, `GITLAB_CLIENT_ID` and `GITLAB_CLIENT_SECRET`.

`read_api` is deliberate: the app only ever reads. Claiming a task is recorded
locally and deep-links to the GitLab issue, so nothing needs write access to a
student's account.

## Indexing real GitLab issues

`pnpm db:seed` is enough to see the whole app working. To index a real
instance, set a **group** access token with `read_api` and the groups to crawl:

```
GITLAB_INDEX_TOKEN="glpat-..."
GITLAB_INDEX_GROUPS="cs-department/web-projects,cs-department/capstone"
```

then `pnpm gitlab:index`.

A group token rather than each student's own token: a student's token only sees
what that student can see, which makes a single shared recommendation index
impossible to build from it.

The worker re-crawls on a timer. There is also a webhook receiver at
`/api/gitlab/webhook` (set `GITLAB_WEBHOOK_SECRET`) for instant updates, but
GitLab cannot reach `localhost`, so scheduled polling is the primary path and
the webhook is only useful once the app is reachable.

## Layout

```
apps/
  web/        Next.js 16 App Router — UI, API routes, server actions
  realtime/   Socket.IO server for chat; future home of the CRDT backend
  worker/     Scheduled GitLab crawl, rescoring, and the seed script
packages/
  db/         Prisma schema, migrations, shared client
  gitlab/     Typed GitLab REST v4 client
  scoring/    Tag extraction and recommendation scoring (pure, no I/O)
  indexer/    Turns GitLab data into the local index; shared by worker and web
  chat/       Message, conversation, search and suggestion operations
```

Two structural decisions are worth knowing before reading the code.

**`packages/scoring` has no database access.** The matching logic is the part
that gets tuned most, so it is kept pure and driven by unit tests rather than
by clicking through the UI. Being pure is also why the same tag extractor
serves both the task feed and the chat suggestions without either importing the
other.

**Chat has one conversation type, not two.** `Conversation` carries a `type` of
`CHANNEL`, `DM` or `GROUP`; channels belong to a workspace and DMs do not.
Delivery, unread counts, mentions, search and attachments therefore have a
single code path. Building channels first and adding DMs later would have meant
rewriting all of them.

## How ranking works

Rule-based and explainable, not machine-learned — at student scale there is no
useful training signal, and a student needs to see why something was suggested.

```
score = 0.40 * skillMatch      cosine similarity of tag vectors
      + 0.20 * interestMatch
      + 0.15 * effortFit       issue estimate vs. weekly hour budget
      + 0.10 * difficultyFit   issue weight vs. experience level
      + 0.10 * freshness       30-day half-life on updated_at
      + 0.05 * projectHealth   activity and backlog age
```

Then penalties for tasks someone already claimed, and for tags the student
keeps dismissing.

Both students and issues reduce to a vector over one shared tag taxonomy
(`packages/scoring/src/taxonomy.ts`). Issue tags come from GitLab labels,
titles and the project's language breakdown; student tags come from onboarding.
Cosine rather than raw overlap, so listing twenty skills does not make someone
a better match for everything than listing three.

Effort fit is scored on the *log* of the estimate/budget ratio, so being 2x out
costs the same at any scale, and it is asymmetric: a task over budget may never
get finished, whereas one under budget just means picking up another.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs web, realtime and worker together |
| `pnpm test` | Unit tests across all packages (75 currently) |
| `pnpm typecheck` | Typechecks every package |
| `pnpm db:migrate` | Applies migrations |
| `pnpm db:seed` | Loads demo data |
| `pnpm db:studio` | Prisma Studio |
| `pnpm gitlab:index` | One-off crawl of the configured groups |

## Notes and limits

- **Push notifications are not implemented.** This is the real gap versus
  WhatsApp: a browser tab cannot buzz a phone, so people will still check
  WhatsApp for anything urgent. Closing it needs an installed PWA served over
  HTTPS from a public domain. Nothing in the design blocks adding it.
- **Documents are not yet real-time.** Editing uses autosave, version history
  and advisory section locks. `Document` already carries a nullable `ydocState`
  column so switching to Yjs is additive: a Hocuspocus server in
  `apps/realtime` can convert existing ProseMirror JSON on load, and the editor
  is already Tiptap, so none of the toolbar or schema work is wasted.
- **Task claiming is local.** It records the claim and links to GitLab rather
  than assigning you there, which would need the read/write `api` scope.

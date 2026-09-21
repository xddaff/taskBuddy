import { searchMessages, SEARCH_LIMIT, type SearchHit } from '@studentproj/chat';
import { prisma } from '@studentproj/db';
import Link from 'next/link';
import { Fragment } from 'react';
import { requireOnboardedUser } from '@/lib/data';
import { absoluteTime, relativeTime } from '@/lib/format';

const MAX_QUERY_LENGTH = 200;

interface Segment {
  text: string;
  marked: boolean;
}

const MARK_TOKEN = /<\/?mark>/g;

/// Splits a ts_headline result into plain and highlighted segments.
///
/// ts_headline wraps matches in <mark> but does not escape the message around
/// them, and that message is user input. Rather than sanitising a string and
/// handing it to dangerouslySetInnerHTML, the headline is cut on the two
/// marker tokens and returned as data, so the page renders it as React text
/// nodes and everything else in it — including anything that looks like a tag
/// — is escaped by React.
///
/// The cost is that a message which literally contains "<mark>" highlights the
/// text after it. That is a wrong highlight, not injected markup.
function highlightSegments(headline: string): Segment[] {
  const segments: Segment[] = [];
  let depth = 0;
  let cursor = 0;

  for (const match of headline.matchAll(MARK_TOKEN)) {
    const start = match.index ?? 0;
    const text = headline.slice(cursor, start);
    if (text) segments.push({ text, marked: depth > 0 });

    depth = match[0] === '<mark>' ? depth + 1 : Math.max(0, depth - 1);
    cursor = start + match[0].length;
  }

  const tail = headline.slice(cursor);
  if (tail) segments.push({ text: tail, marked: depth > 0 });

  return segments;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { user } = await requireOnboardedUser();

  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')).trim().slice(0, MAX_QUERY_LENGTH);

  const hits = query ? await searchMessages({ userId: user.id, query }) : [];

  // Hits in a DM or an unnamed group have no name of their own, so the other
  // participants are fetched to label them.
  const unnamedIds = [...new Set(hits.filter((hit) => !hit.conversationName).map((hit) => hit.conversationId))];
  const participants = unnamedIds.length
    ? await prisma.conversationMember.findMany({
        where: { conversationId: { in: unnamedIds }, userId: { not: user.id } },
        select: { conversationId: true, user: { select: { name: true } } },
      })
    : [];

  const partnerNames = new Map<string, string[]>();
  for (const participant of participants) {
    const names = partnerNames.get(participant.conversationId) ?? [];
    names.push(participant.user.name ?? 'Unknown');
    partnerNames.set(participant.conversationId, names);
  }

  const now = new Date();

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Search messages</h1>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            Across every channel, group and DM you are in. Nothing else.
          </p>
        </header>

        <form role="search" method="get" className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="q" className="sr-only">
              Search your messages
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              autoComplete="off"
              maxLength={MAX_QUERY_LENGTH}
              placeholder="docker compose, accessibility, standup..."
              className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2 text-sm placeholder:text-(--color-ink-faint) focus:border-(--color-accent) focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-(--color-accent) px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Search
          </button>
        </form>

        <p aria-live="polite" className="mt-3 text-xs text-(--color-ink-faint)">
          {!query
            ? ''
            : hits.length === 0
              ? `No messages match ${query}.`
              : `${hits.length}${hits.length === SEARCH_LIMIT ? '+' : ''} ${
                  hits.length === 1 ? 'message' : 'messages'
                } matching ${query}.`}
        </p>

        <div className="mt-4">
          {!query ? (
            <Placeholder title="Search what your team has already said">
              Full text, so &ldquo;docker&rdquo; finds &ldquo;dockerised&rdquo; too. Try a phrase
              in quotes for an exact match, or <code className="text-(--color-ink)">-word</code> to
              exclude one.
            </Placeholder>
          ) : hits.length === 0 ? (
            <Placeholder title="No messages match that">
              Nothing in your conversations contains {query}. Try fewer words, or a word that
              would have been typed rather than one that describes it.
            </Placeholder>
          ) : (
            <ul className="space-y-2">
              {hits.map((hit) => (
                <li key={hit.messageId}>
                  <Result hit={hit} partners={partnerNames.get(hit.conversationId)} now={now} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

function conversationLabel(hit: SearchHit, partners: string[] | undefined): string {
  if (hit.conversationType === 'CHANNEL') return `#${hit.conversationName ?? 'channel'}`;
  if (hit.conversationName) return hit.conversationName;
  const names = partners ?? [];
  if (names.length === 0) return 'Just you';
  return names.join(', ');
}

function Result({
  hit,
  partners,
  now,
}: {
  hit: SearchHit;
  partners: string[] | undefined;
  now: Date;
}) {
  return (
    <Link
      href={`/c/${hit.conversationId}#message-${hit.messageId}`}
      className="block rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-4 transition hover:border-(--color-ink-faint)"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm">
          <span className="font-medium">{hit.authorName ?? 'Unknown'}</span>
          <span className="text-(--color-ink-faint)"> in </span>
          <span className="text-(--color-ink-muted)">
            {conversationLabel(hit, partners)}
            {hit.workspaceName ? ` · ${hit.workspaceName}` : ''}
          </span>
        </p>
        <time
          dateTime={new Date(hit.createdAt).toISOString()}
          title={absoluteTime(hit.createdAt)}
          className="shrink-0 text-xs text-(--color-ink-faint)"
        >
          {relativeTime(hit.createdAt, now)}
        </time>
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-(--color-ink-muted)">
        {highlightSegments(hit.headline).map((segment, index) => (
          <Fragment key={index}>
            {segment.marked ? (
              <mark className="rounded bg-(--color-accent-soft) px-0.5 text-(--color-ink)">
                {segment.text}
              </mark>
            ) : (
              segment.text
            )}
          </Fragment>
        ))}
      </p>
    </Link>
  );
}

function Placeholder({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-6">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-(--color-ink-muted)">{children}</p>
    </div>
  );
}

import { describe, expect, it, vi } from 'vitest';
import { GitlabClient, GitlabError } from './client';
import { computeProjectHealth } from './health';
import type { GitlabIssue } from './types';

function jsonResponse(body: unknown, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function clientWith(fetchImpl: typeof fetch) {
  return new GitlabClient({
    baseUrl: 'https://gitlab.example.edu/',
    token: 'test-token',
    fetchImpl,
  });
}

describe('GitlabClient', () => {
  it('targets the v4 API on the configured instance and sends a bearer token', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 1, username: 'ilya' }));
    await clientWith(fetchImpl as unknown as typeof fetch).currentUser();

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://gitlab.example.edu/api/v4/user');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('follows x-next-page until the last page', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const page = new URL(url).searchParams.get('page');
      if (page === '1') return jsonResponse([{ id: 1 }], { 'x-next-page': '2' });
      if (page === '2') return jsonResponse([{ id: 2 }], { 'x-next-page': '3' });
      return jsonResponse([{ id: 3 }], { 'x-next-page': '' });
    });

    const issues = await clientWith(fetchImpl as unknown as typeof fetch).projectIssues(7);
    expect(issues.map((issue) => issue.id)).toEqual([1, 2, 3]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('stops paginating if the instance reports a non-advancing next page', async () => {
    // Guards against an infinite loop on a misbehaving or proxied instance.
    const fetchImpl = vi.fn(async () => jsonResponse([{ id: 1 }], { 'x-next-page': '1' }));

    const issues = await clientWith(fetchImpl as unknown as typeof fetch).projectIssues(7);
    expect(issues).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries server errors and then succeeds', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({ message: 'boom' }, {}, 503);
      return jsonResponse({ id: 1, username: 'ilya' });
    });

    vi.useFakeTimers();
    const promise = clientWith(fetchImpl as unknown as typeof fetch).currentUser();
    await vi.runAllTimersAsync();
    const user = await promise;
    vi.useRealTimers();

    expect(user.username).toBe('ilya');
    expect(calls).toBe(2);
  });

  it('does not retry a 404, which will never succeed', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: 'Not found' }, {}, 404));

    await expect(
      clientWith(fetchImpl as unknown as typeof fetch).project('nope/nope'),
    ).rejects.toBeInstanceOf(GitlabError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('classifies auth failures so the indexer can report a bad token', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: '401' }, {}, 401));

    await expect(
      clientWith(fetchImpl as unknown as typeof fetch).currentUser(),
    ).rejects.toMatchObject({ isAuthFailure: true });
  });

  it('treats a missing language report as empty rather than fatal', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: '404' }, {}, 404));
    const languages = await clientWith(fetchImpl as unknown as typeof fetch).projectLanguages(7);
    expect(languages).toEqual({});
  });

  it('drops archived projects from group listings', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        [
          { id: 1, name: 'live', archived: false },
          { id: 2, name: 'dead', archived: true },
        ],
        { 'x-next-page': '' },
      ),
    );

    const projects = await clientWith(fetchImpl as unknown as typeof fetch).groupProjects('cs/web');
    expect(projects.map((project) => project.name)).toEqual(['live']);
  });
});

describe('computeProjectHealth', () => {
  const NOW = new Date('2026-09-21T12:00:00Z');
  const issue = (createdDaysAgo: number): GitlabIssue =>
    ({
      created_at: new Date(NOW.getTime() - createdDaysAgo * 86_400_000).toISOString(),
    }) as GitlabIssue;

  it('rates an active project with a fresh backlog above a dormant one', () => {
    const active = computeProjectHealth(
      { lastActivityAt: new Date(NOW.getTime() - 2 * 86_400_000), openIssues: [issue(5), issue(10)] },
      NOW,
    );
    const dormant = computeProjectHealth(
      {
        lastActivityAt: new Date(NOW.getTime() - 400 * 86_400_000),
        openIssues: [issue(500), issue(600)],
      },
      NOW,
    );

    expect(active.score).toBeGreaterThan(dormant.score);
  });

  it('reports the median backlog age', () => {
    const health = computeProjectHealth(
      { lastActivityAt: NOW, openIssues: [issue(10), issue(20), issue(30)] },
      NOW,
    );
    expect(health.medianIssueAgeDays).toBeCloseTo(20, 5);
    expect(health.openIssueCount).toBe(3);
  });

  it('stays in range with no issues and no activity data', () => {
    const health = computeProjectHealth({ lastActivityAt: null, openIssues: [] }, NOW);
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(1);
    expect(health.medianIssueAgeDays).toBeNull();
  });
});

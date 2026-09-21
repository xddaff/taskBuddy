import { applyIssueEvent, verifyWebhookToken } from '@studentproj/indexer';
import type { GitlabIssueEvent } from '@studentproj/gitlab';
import { NextResponse } from 'next/server';
import { env } from '@/env';

/// Receives GitLab `issue` webhook events and refreshes that one issue.
///
/// This is an accelerator, not a requirement. The worker's scheduled resync is
/// the primary path, because the app runs on localhost for the demo where
/// GitLab cannot reach it. Everything still works with this endpoint never
/// being called.
export async function POST(request: Request): Promise<NextResponse> {
  if (!env.gitlabWebhookSecret) {
    // Refuse rather than accept unauthenticated writes into the index. An
    // unconfigured webhook should be inert, not open.
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  }

  if (!verifyWebhookToken(request.headers.get('x-gitlab-token'), env.gitlabWebhookSecret)) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
  }

  if (!env.gitlabIndexToken) {
    // The handler re-fetches the issue from the API rather than trusting the
    // payload, so it cannot work without a read token.
    return NextResponse.json({ error: 'GITLAB_INDEX_TOKEN is not set.' }, { status: 503 });
  }

  let event: GitlabIssueEvent;
  try {
    event = (await request.json()) as GitlabIssueEvent;
  } catch {
    return NextResponse.json({ error: 'Body was not JSON.' }, { status: 400 });
  }

  try {
    const result = await applyIssueEvent(event, {
      baseUrl: env.gitlabBaseUrl,
      token: env.gitlabIndexToken,
    });

    // 200 even when ignored: GitLab retries and eventually disables hooks that
    // keep erroring, and "this project is not in our curated index" is a
    // correct, final outcome rather than a failure to retry.
    return NextResponse.json(result);
  } catch (error) {
    console.error('[webhook] failed to apply issue event:', error);
    return NextResponse.json({ error: 'Could not apply the event.' }, { status: 500 });
  }
}

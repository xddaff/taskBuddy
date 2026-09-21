import { findIssuesForCommand } from '@studentproj/chat';
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import type { SuggestedTaskDto } from '@/lib/chat-types';

const MAX_QUERY_LENGTH = 120;

/// Issue lookup behind the composer's `/task <query>` command.
///
/// The index is shared across the instance by design, so there is no
/// per-conversation scope here; being signed in is the access rule.
export async function GET(request: Request): Promise<NextResponse> {
  const user = await currentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const query = (new URL(request.url).searchParams.get('q') ?? '').slice(0, MAX_QUERY_LENGTH);

  const issues = await findIssuesForCommand({ query });
  const body: { issues: SuggestedTaskDto[] } = { issues };

  return NextResponse.json(body);
}

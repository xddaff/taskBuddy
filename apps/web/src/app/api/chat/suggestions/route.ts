import { ChatError, dismissSuggestion, suggestTasksForChat } from '@studentproj/chat';
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import type { SuggestionsDto } from '@/lib/chat-types';

/// Tasks the conversation is currently about, for the "Related tasks" panel.
///
/// A route rather than server-rendered data because the panel refetches on a
/// debounce as the conversation moves, and re-rendering the whole page for that
/// would fight the socket-driven message list.
export async function GET(request: Request): Promise<NextResponse> {
  const user = await currentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const conversationId = new URL(request.url).searchParams.get('conversationId');
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is required.' }, { status: 400 });
  }

  try {
    const result = await suggestTasksForChat({ conversationId, userId: user.id });
    const body: SuggestionsDto = result;
    return NextResponse.json(body);
  } catch (error) {
    return failure(error, 'Could not work out related tasks.');
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await currentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body was not JSON.' }, { status: 400 });
  }

  const { conversationId, issueId } = (payload ?? {}) as Record<string, unknown>;
  if (typeof conversationId !== 'string' || typeof issueId !== 'string') {
    return NextResponse.json(
      { error: 'conversationId and issueId are required.' },
      { status: 400 },
    );
  }

  try {
    await dismissSuggestion({ conversationId, issueId, userId: user.id });
    return NextResponse.json({ dismissed: true });
  } catch (error) {
    return failure(error, 'Could not dismiss that suggestion.');
  }
}

/// A ChatError is the membership check refusing, which is a 403 and safe to
/// show; anything else is ours and must not leak its message.
function failure(error: unknown, fallback: string): NextResponse {
  if (error instanceof ChatError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  console.error('[chat/suggestions]', error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

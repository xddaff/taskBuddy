'use server';

import {
  ChatError,
  createChannel,
  createGroupConversation,
  dismissSuggestion,
  listMessages,
  openDirectMessage,
  setMuted,
} from '@studentproj/chat';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserId } from '@/lib/auth';
import { toWireMessage } from '@/lib/chat-serialise';
import type { WireMessage } from '@/lib/chat-types';

/// Conversation-level actions only.
///
/// Sending, editing, deleting and reacting all go over the socket instead, so
/// that the author's own client learns about them through the same broadcast as
/// everybody else's and there is one code path to keep correct.

export interface ConversationActionState {
  error: string | null;
}

export async function startDm(
  _previous: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const userId = await requireUserId();
  const otherUserId = asString(formData.get('userId'));
  if (!otherUserId) return { error: 'Pick somebody to message.' };

  let conversationId: string;
  try {
    const conversation = await openDirectMessage(userId, otherUserId);
    conversationId = conversation.id;
  } catch (error) {
    return { error: describe(error, 'Could not open that conversation.') };
  }

  // The sidebar lists conversations, and it lives in the layout.
  revalidatePath('/', 'layout');
  // Outside the try: redirect signals by throwing, and catching it here would
  // turn a successful action into an error message.
  redirect(`/c/${conversationId}`);
}

export async function startGroup(
  _previous: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const userId = await requireUserId();

  const memberIds = formData
    .getAll('userId')
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const name = asString(formData.get('name'));

  let conversationId: string;
  try {
    const conversation = await createGroupConversation({
      createdById: userId,
      memberIds,
      name: name || null,
    });
    conversationId = conversation.id;
  } catch (error) {
    return { error: describe(error, 'Could not create that group.') };
  }

  revalidatePath('/', 'layout');
  redirect(`/c/${conversationId}`);
}

export async function createChannelAction(
  _previous: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const userId = await requireUserId();
  const workspaceId = asString(formData.get('workspaceId'));
  const name = asString(formData.get('name'));
  const topic = asString(formData.get('topic'));

  if (!workspaceId) return { error: 'Missing workspace.' };

  let conversationId: string;
  try {
    const channel = await createChannel({
      workspaceId,
      createdById: userId,
      name,
      topic: topic || null,
    });
    conversationId = channel.id;
  } catch (error) {
    return { error: describe(error, 'Could not create that channel.') };
  }

  revalidatePath('/', 'layout');
  redirect(`/c/${conversationId}`);
}

/// Progressive-enhancement form action: the new state is submitted rather than
/// derived, so a double submit cannot flip mute the wrong way.
export async function toggleMute(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const conversationId = asString(formData.get('conversationId'));
  const muted = formData.get('muted') === 'true';
  if (!conversationId) return;

  try {
    await setMuted({ conversationId, userId, muted });
  } catch (error) {
    if (!(error instanceof ChatError)) throw error;
    return;
  }

  revalidatePath(`/c/${conversationId}`);
}

export async function dismissSuggestionAction(
  conversationId: string,
  issueId: string,
): Promise<ConversationActionState> {
  const userId = await requireUserId();

  try {
    await dismissSuggestion({ conversationId, issueId, userId });
  } catch (error) {
    return { error: describe(error, 'Could not dismiss that suggestion.') };
  }

  return { error: null };
}

/// One older page of history for the message list's "load earlier" control.
///
/// A read, not a mutation: it is here rather than behind a route handler so the
/// client gets the same typed `WireMessage` it already renders.
export async function loadOlderMessages(
  conversationId: string,
  before: string,
): Promise<{ messages: WireMessage[]; hasMore: boolean; error: string | null }> {
  const userId = await requireUserId();

  try {
    const page = await listMessages({ conversationId, userId, before });
    return { messages: page.messages.map(toWireMessage), hasMore: page.hasMore, error: null };
  } catch (error) {
    return {
      messages: [],
      hasMore: false,
      error: describe(error, 'Could not load earlier messages.'),
    };
  }
}

function asString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

/// A ChatError is a rule the student broke and is written for them; anything
/// else is a defect and must not be shown.
function describe(error: unknown, fallback: string): string {
  if (error instanceof ChatError) return error.message;
  console.error('[chat/actions]', error);
  return fallback;
}

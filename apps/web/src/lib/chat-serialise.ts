import type { ChatMessage } from '@studentproj/chat';
import type { TaskCardMetadata, WireMessage } from './chat-types';

/// Converts a message row into the shape the client renders.
///
/// Deliberately identical to what the realtime service broadcasts, so a message
/// that arrives over the socket and one that came with the initial page render
/// are indistinguishable to the UI.
export function toWireMessage(message: ChatMessage): WireMessage {
  return {
    id: message.id,
    conversationId: message.conversationId,
    body: message.body,
    kind: message.kind,
    metadata: asTaskCardMetadata(message.metadata),
    replyToId: message.replyToId,
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedAt: message.deletedAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    authorId: message.authorId,
    author: message.author,
    reactions: message.reactions,
    attachments: message.attachments,
    mentions: message.mentions,
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          body: message.replyTo.body,
          deletedAt: message.replyTo.deletedAt?.toISOString() ?? null,
          author: message.replyTo.author,
        }
      : null,
  };
}

/// Message metadata is an untyped Json column, so it is validated rather than
/// asserted: an old or hand-written row must degrade to a plain message instead
/// of rendering a card with undefined fields.
function asTaskCardMetadata(value: unknown): TaskCardMetadata | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  if (typeof record.title !== 'string' || typeof record.webUrl !== 'string') return null;

  return {
    issueId: typeof record.issueId === 'string' ? record.issueId : '',
    title: record.title,
    webUrl: record.webUrl,
    projectPath: typeof record.projectPath === 'string' ? record.projectPath : '',
    labels: Array.isArray(record.labels)
      ? record.labels.filter((label): label is string => typeof label === 'string')
      : [],
    estimatedHours: typeof record.estimatedHours === 'number' ? record.estimatedHours : null,
  };
}

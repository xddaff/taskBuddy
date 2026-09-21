import type { TaskCardMetadata } from '@/lib/chat-types';

export interface ChatMember {
  id: string;
  name: string | null;
  image: string | null;
  gitlabUsername: string | null;
}

/// An attachment that has been uploaded but not yet sent with a message.
export interface UploadedAttachment {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  url: string;
}

export interface OutgoingMessage {
  body: string;
  replyToId: string | null;
  attachments: UploadedAttachment[];
  kind: 'TEXT' | 'TASK_CARD';
  metadata?: TaskCardMetadata;
}

/// A message the client has emitted but not yet seen broadcast back.
///
/// Rendered in place of the real one so sending feels immediate; replaced when
/// the server's `message:new` arrives, or rolled back if it never does.
export interface PendingMessage extends OutgoingMessage {
  clientId: string;
  createdAt: string;
  replyToLabel: string | null;
}

/// Wire shape of a message as the realtime service serialises it.
///
/// Dates arrive as ISO strings because JSON has no date type; the client
/// formats them rather than re-parsing into Date objects it does not need.
export interface WireMessage {
  id: string;
  conversationId: string;
  body: string;
  kind: 'TEXT' | 'TASK_CARD' | 'SYSTEM';
  metadata: TaskCardMetadata | null;
  replyToId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  authorId: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    gitlabUsername: string | null;
  };
  reactions: Array<{ emoji: string; userId: string }>;
  attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    byteSize: number;
    width: number | null;
    height: number | null;
    storageKey: string;
    thumbnailKey: string | null;
  }>;
  mentions: Array<{ userId: string }>;
  replyTo: {
    id: string;
    body: string;
    deletedAt: string | null;
    author: { name: string | null };
  } | null;
}

/// Payload carried by a TASK_CARD message: a snapshot of the issue at the time
/// it was shared, so the card still reads correctly if the issue later changes
/// or is closed.
export interface TaskCardMetadata {
  issueId: string;
  title: string;
  webUrl: string;
  projectPath: string;
  labels: string[];
  estimatedHours: number | null;
}

export interface SuggestedTaskDto {
  issueId: string;
  title: string;
  webUrl: string;
  projectPath: string;
  labels: string[];
  estimatedHours: number | null;
  relevance: number;
  matchedTags: string[];
  reason: string;
}

export interface SuggestionsDto {
  topics: string[];
  confident: boolean;
  tasks: SuggestedTaskDto[];
}

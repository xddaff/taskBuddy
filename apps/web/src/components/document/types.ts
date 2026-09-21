/// Wire shapes shared by the document server actions, the presence endpoint
/// and the editor. Dates travel as ISO strings because JSON has no date type.

export interface LockHolder {
  sectionId: string;
  userId: string;
  name: string | null;
  image: string | null;
  acquiredAt: string;
  expiresAt: string;
}

export interface PresencePayload {
  documentId: string;
  /// Server time the snapshot was taken at, so a client with a skewed clock
  /// can still tell how long a lock has left.
  now: string;
  locks: LockHolder[];
}

export type SaveResult =
  | { status: 'saved'; updatedAt: string }
  /// The stored document moved on since the client last read it. Carries the
  /// current server state so the editor can offer a reload instead of
  /// silently clobbering someone else's paragraph.
  | { status: 'conflict'; updatedAt: string; content: unknown; changedBy: string | null }
  | { status: 'error'; message: string };

export type LockResult =
  | { status: 'acquired'; sectionId: string; expiresAt: string }
  | { status: 'held'; sectionId: string; by: LockHolder }
  | { status: 'error'; message: string };

import { prisma } from "@/lib/db";
import { isMaintainer, type Student } from "@/lib/types";

export type ChatRoomKey = "students" | "class";

export type ChatRoom = {
  key: ChatRoomKey;
  label: string;
  description: string;
};

export const CHAT_ROOMS: ChatRoom[] = [
  {
    key: "students",
    label: "Class",
    description: "Class discussion. Students and the instructor can both read and post.",
  },
  {
    key: "class",
    label: "Teacher",
    description: "Chat with the instructor about the course.",
  },
];

export const MESSAGE_MAX_LENGTH = 2000;

const DEFAULT_LIMIT = 200;

export function isChatRoomKey(value: unknown): value is ChatRoomKey {
  return value === "students" || value === "class";
}

export function canAccessRoom(_student: Student, room: ChatRoomKey): boolean {
  return isChatRoomKey(room);
}

export function roomsFor(_student: Student): ChatRoom[] {
  return CHAT_ROOMS;
}

export function defaultRoomFor(student: Student): ChatRoomKey {
  return isMaintainer(student) ? "class" : "students";
}

export type ChatMessageView = {
  id: number;
  room: ChatRoomKey;
  gitlabUserId: number;
  authorName: string;
  authorUsername: string;
  body: string;
  createdAt: string;
};

type ChatMessageRow = {
  id: number;
  room: string;
  gitlabUserId: number;
  authorName: string;
  authorUsername: string;
  body: string;
  createdAt: Date;
};

function toView(row: ChatMessageRow): ChatMessageView {
  return {
    id: row.id,
    room: row.room as ChatRoomKey,
    gitlabUserId: row.gitlabUserId,
    authorName: row.authorName,
    authorUsername: row.authorUsername,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listMessages(
  room: ChatRoomKey,
  limit: number = DEFAULT_LIMIT,
): Promise<ChatMessageView[]> {
  const take = Math.min(Math.max(Math.trunc(limit) || DEFAULT_LIMIT, 1), 500);
  const rows = await prisma.chatMessage.findMany({
    where: { room },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(toView).reverse();
}

export async function postMessage(
  student: Student,
  room: ChatRoomKey,
  body: string,
): Promise<ChatMessageView> {
  if (!canAccessRoom(student, room)) {
    throw new Error("You do not have access to this room");
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new Error("Message cannot be empty");
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    throw new Error(`Message cannot be longer than ${MESSAGE_MAX_LENGTH} characters`);
  }

  const row = await prisma.chatMessage.create({
    data: {
      room,
      gitlabUserId: student.gitlabUserId,
      // Snapshotted so messages survive a demo reseed that wipes the Student table.
      authorName: student.name,
      authorUsername: student.username,
      body: trimmed,
    },
  });
  return toView(row);
}

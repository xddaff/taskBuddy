import { NextResponse } from "next/server";
import {
  MESSAGE_MAX_LENGTH,
  canAccessRoom,
  isChatRoomKey,
  listMessages,
  postMessage,
} from "@/lib/chat";
import { getCurrentStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to the empty body, which fails validation below.
  }
  return {};
}

export async function GET(request: Request) {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Sign in to read the chat" }, { status: 401 });
  }

  const room = new URL(request.url).searchParams.get("room");
  if (!isChatRoomKey(room)) {
    return NextResponse.json({ error: "Unknown chat room" }, { status: 400 });
  }
  if (!canAccessRoom(student, room)) {
    return NextResponse.json({ error: "You cannot access this room" }, { status: 403 });
  }

  const messages = await listMessages(room);
  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Sign in to post a message" }, { status: 401 });
  }

  const payload = await readBody(request);
  const room = payload.room;
  if (!isChatRoomKey(room)) {
    return NextResponse.json({ error: "Unknown chat room" }, { status: 400 });
  }
  if (!canAccessRoom(student, room)) {
    return NextResponse.json({ error: "You cannot access this room" }, { status: 403 });
  }

  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (body.length === 0) {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
  }
  if (body.length > MESSAGE_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Message cannot be longer than ${MESSAGE_MAX_LENGTH} characters` },
      { status: 400 },
    );
  }

  const message = await postMessage(student, room, body);
  return NextResponse.json({ ok: true, message });
}

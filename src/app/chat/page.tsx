import { redirect } from "next/navigation";
import { ChatPanel } from "@/components/ChatPanel";
import { NavBar } from "@/components/NavBar";
import { defaultRoomFor, listMessages, roomsFor } from "@/lib/chat";
import { getCurrentStudent } from "@/lib/session";
import { isMaintainer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const student = await getCurrentStudent();
  if (!student) redirect("/");

  const rooms = roomsFor(student);
  const initialRoom = defaultRoomFor(student);
  const initialMessages = await listMessages(initialRoom);

  return (
    <div className="flex min-h-dvh flex-col">
      <NavBar student={student} active="chat" />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 p-3">
        <div className="px-2 pt-1">
          <h1 className="text-2xl font-medium tracking-tight">Chat</h1>
          <p className="mt-1 text-sm text-muted">
            {isMaintainer(student) ? (
              <>
                You can post in the class chat. The students-only room is private to students, so it
                is not readable by instructors.
              </>
            ) : (
              <>
                Two rooms: one just for students, and one shared with the instructor. Messages
                refresh every few seconds.
              </>
            )}
          </p>
        </div>

        <div className="min-h-[32rem] flex-1">
          <ChatPanel
            rooms={rooms}
            initialRoom={initialRoom}
            initialMessages={initialMessages}
            viewerUserId={student.gitlabUserId}
          />
        </div>
      </main>
    </div>
  );
}

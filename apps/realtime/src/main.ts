import {
  ChatError,
  conversationIdsFor,
  deleteMessage,
  editMessage,
  markRead,
  sendMessage,
  toggleReaction,
  type ChatMessage,
} from '@studentproj/chat';
import { prisma } from '@studentproj/db';
import { config as loadEnv } from 'dotenv';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Server, type Socket } from 'socket.io';
import { authenticateSocket, type SocketUser } from './session';

const rootEnv = resolve(import.meta.dirname, '../../../.env');
if (existsSync(rootEnv)) loadEnv({ path: rootEnv, quiet: true });

const PORT = Number.parseInt(process.env.REALTIME_PORT ?? '3001', 10);
const WEB_ORIGIN = process.env.AUTH_URL ?? 'http://localhost:3000';

const log = (message: string) => console.log(`[realtime] ${message}`);

/// Room name for a conversation. Prefixed so a conversation id can never
/// collide with the per-user rooms below.
const room = (conversationId: string) => `conversation:${conversationId}`;
const userRoom = (userId: string) => `user:${userId}`;

interface AuthedSocket extends Socket {
  data: { user: SocketUser };
}

const httpServer = createServer((request, response) => {
  // A plain health endpoint, so `pnpm dev` failures are visible without
  // opening a websocket.
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, service: 'realtime' }));
    return;
  }
  response.writeHead(404).end();
});

const io = new Server(httpServer, {
  cors: {
    origin: WEB_ORIGIN,
    // Required for the browser to send the session cookie cross-port.
    credentials: true,
  },
});

/// Authenticate during the handshake rather than after connecting, so an
/// unauthenticated socket never joins a room or receives an event.
io.use(async (socket, next) => {
  try {
    const user = await authenticateSocket(socket.handshake.headers.cookie);
    if (!user) {
      next(new Error('unauthorised'));
      return;
    }
    socket.data.user = user;
    next();
  } catch (error) {
    log(`handshake failed: ${error instanceof Error ? error.message : String(error)}`);
    next(new Error('handshake failed'));
  }
});

io.on('connection', (socket) => {
  const { user } = (socket as AuthedSocket).data;

  void subscribe(socket as AuthedSocket, user);

  socket.on('message:send', withErrors(socket, async (payload: unknown) => {
    const input = asSendPayload(payload);
    const message = await sendMessage({
      conversationId: input.conversationId,
      authorId: user.id,
      body: input.body,
      replyToId: input.replyToId,
      attachmentIds: input.attachmentIds,
      kind: input.kind,
      metadata: input.metadata,
    });

    io.to(room(message.conversationId)).emit('message:new', serialise(message));
    await notifyMentioned(message);
  }));

  socket.on('message:edit', withErrors(socket, async (payload: unknown) => {
    const { messageId, body } = asRecord(payload);
    const message = await editMessage({
      messageId: asString(messageId, 'messageId'),
      userId: user.id,
      body: asString(body, 'body'),
    });
    io.to(room(message.conversationId)).emit('message:updated', serialise(message));
  }));

  socket.on('message:delete', withErrors(socket, async (payload: unknown) => {
    const { messageId } = asRecord(payload);
    const message = await deleteMessage({
      messageId: asString(messageId, 'messageId'),
      userId: user.id,
    });
    io.to(room(message.conversationId)).emit('message:updated', serialise(message));
  }));

  socket.on('reaction:toggle', withErrors(socket, async (payload: unknown) => {
    const { messageId, emoji } = asRecord(payload);
    const message = await toggleReaction({
      messageId: asString(messageId, 'messageId'),
      userId: user.id,
      emoji: asString(emoji, 'emoji'),
    });
    io.to(room(message.conversationId)).emit('message:updated', serialise(message));
  }));

  socket.on('conversation:read', withErrors(socket, async (payload: unknown) => {
    const { conversationId, messageId } = asRecord(payload);
    await markRead({
      conversationId: asString(conversationId, 'conversationId'),
      userId: user.id,
      messageId: typeof messageId === 'string' ? messageId : undefined,
    });
    // Only the reader cares, but they may have several tabs open.
    io.to(userRoom(user.id)).emit('conversation:read', { conversationId });
  }));

  socket.on('typing', (payload: unknown) => {
    const { conversationId } = asRecord(payload);
    if (typeof conversationId !== 'string') return;
    // Not persisted and not validated against membership: the worst case is a
    // wasted broadcast into a room the sender is not in, which reaches nobody
    // because they were never joined to it.
    if (!socket.rooms.has(room(conversationId))) return;

    socket.to(room(conversationId)).emit('typing', {
      conversationId,
      userId: user.id,
      name: user.name,
    });
  });

  /// A conversation created after this socket connected, e.g. a new DM.
  socket.on('conversation:subscribe', withErrors(socket, async (payload: unknown) => {
    const { conversationId } = asRecord(payload);
    const id = asString(conversationId, 'conversationId');

    // Re-derive membership rather than trusting the client's claim.
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: user.id } },
      select: { id: true },
    });
    if (membership) socket.join(room(id));
  }));

  socket.on('disconnect', () => {
    for (const joined of socket.rooms) {
      if (joined.startsWith('conversation:')) {
        socket.to(joined).emit('presence:left', { userId: user.id });
      }
    }
  });
});

async function subscribe(socket: AuthedSocket, user: SocketUser): Promise<void> {
  try {
    const conversationIds = await conversationIdsFor(user.id);
    socket.join(userRoom(user.id));
    for (const conversationId of conversationIds) {
      socket.join(room(conversationId));
    }
    socket.emit('ready', { userId: user.id, conversations: conversationIds });
  } catch (error) {
    log(`subscribe failed for ${user.id}: ${describe(error)}`);
    socket.emit('error:chat', { message: 'Could not load your conversations.' });
  }
}

/// Tells mentioned users about a message in a conversation they may not
/// currently have open, so the sidebar badge updates without a refresh.
async function notifyMentioned(message: ChatMessage): Promise<void> {
  for (const mention of message.mentions) {
    io.to(userRoom(mention.userId)).emit('mention:new', {
      conversationId: message.conversationId,
      messageId: message.id,
    });
  }
}

/// Wraps a handler so a thrown ChatError becomes a message to the sender rather
/// than an unhandled rejection that takes the process down.
function withErrors(socket: Socket, handler: (payload: unknown) => Promise<void>) {
  return (payload: unknown) => {
    void handler(payload).catch((error) => {
      if (error instanceof ChatError) {
        socket.emit('error:chat', { message: error.message });
        return;
      }
      log(`handler failed: ${describe(error)}`);
      socket.emit('error:chat', { message: 'Something went wrong. Try again.' });
    });
  };
}

/// Dates do not survive JSON, so they are sent as ISO strings and the client
/// parses them once rather than guessing per field.
function serialise(message: ChatMessage) {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedAt: message.deletedAt?.toISOString() ?? null,
  };
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null) {
    throw new ChatError('Malformed request.');
  }
  return payload as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) throw new ChatError(`Missing ${field}.`);
  return value;
}

function asSendPayload(payload: unknown) {
  const record = asRecord(payload);
  const kind = record.kind;

  return {
    conversationId: asString(record.conversationId, 'conversationId'),
    body: typeof record.body === 'string' ? record.body : '',
    replyToId: typeof record.replyToId === 'string' ? record.replyToId : null,
    attachmentIds: Array.isArray(record.attachmentIds)
      ? record.attachmentIds.filter((id): id is string => typeof id === 'string')
      : [],
    // Only TASK_CARD is client-selectable; SYSTEM messages are written by the
    // server, so accepting it here would let a client forge one.
    kind: kind === 'TASK_CARD' ? ('TASK_CARD' as const) : ('TEXT' as const),
    metadata:
      typeof record.metadata === 'object' && record.metadata !== null
        ? (record.metadata as Record<string, unknown>)
        : undefined,
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

httpServer.listen(PORT, () => {
  log(`Listening on :${PORT}, accepting sockets from ${WEB_ORIGIN}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    log(`${signal} received, shutting down.`);
    io.close(() => {
      void prisma.$disconnect().then(() => process.exit(0));
    });
  });
}

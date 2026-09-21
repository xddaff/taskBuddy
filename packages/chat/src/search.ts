import { prisma } from '@studentproj/db';

export interface SearchHit {
  messageId: string;
  conversationId: string;
  conversationType: string;
  conversationName: string | null;
  workspaceName: string | null;
  authorName: string | null;
  body: string;
  headline: string;
  createdAt: Date;
  rank: number;
}

export const SEARCH_LIMIT = 40;

/// Full-text search across the caller's conversations.
///
/// Uses the Postgres GENERATED tsvector column on Message with its GIN index,
/// rather than a separate search engine: one migration, always consistent with
/// the message body, and comfortable at student scale.
///
/// Raw SQL because Prisma cannot express tsquery matching, ts_rank or
/// ts_headline. The only interpolated values are bound parameters.
///
/// The membership join is the security boundary. Search is the easiest place to
/// leak a private DM, so results are restricted to conversations the caller is
/// a member of in the query itself rather than filtered afterwards.
export async function searchMessages(input: {
  userId: string;
  query: string;
  limit?: number;
}): Promise<SearchHit[]> {
  const query = input.query.trim();
  if (!query) return [];

  const limit = Math.min(input.limit ?? SEARCH_LIMIT, 100);

  return prisma.$queryRaw<SearchHit[]>`
    SELECT
      m.id                AS "messageId",
      m."conversationId"  AS "conversationId",
      c.type::text        AS "conversationType",
      c.name              AS "conversationName",
      w.name              AS "workspaceName",
      u.name              AS "authorName",
      m.body              AS "body",
      ts_headline(
        'english',
        m.body,
        websearch_to_tsquery('english', ${query}),
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=18, MinWords=5'
      )                   AS "headline",
      m."createdAt"       AS "createdAt",
      ts_rank(m."searchVector", websearch_to_tsquery('english', ${query})) AS "rank"
    FROM "Message" m
      JOIN "ConversationMember" cm
        ON cm."conversationId" = m."conversationId" AND cm."userId" = ${input.userId}
      JOIN "Conversation" c ON c.id = m."conversationId"
      LEFT JOIN "Workspace" w ON w.id = c."workspaceId"
      JOIN "User" u ON u.id = m."authorId"
    WHERE m."deletedAt" IS NULL
      AND m."searchVector" @@ websearch_to_tsquery('english', ${query})
    ORDER BY "rank" DESC, m."createdAt" DESC
    LIMIT ${limit}
  `;
}

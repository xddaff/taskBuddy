/// Usernames follow GitLab's rules: letters, digits, underscore, dot, dash.
/// The trailing lookahead stops a sentence-ending period from being eaten as
/// part of the name ("ask @sara." mentions sara, not "sara.").
const MENTION_PATTERN = /(^|[^\w@])@([a-zA-Z0-9][a-zA-Z0-9._-]{0,48}[a-zA-Z0-9]|[a-zA-Z0-9])/g;

export const MENTION_ALL = 'all';

export interface ParsedMentions {
  usernames: string[];
  mentionsEveryone: boolean;
}

/// Extracts @mentions from a message body.
///
/// Deliberately syntactic only: it does not know which usernames exist. The
/// caller resolves them against conversation membership, which is also the
/// check that stops an @mention being used to notify someone who is not in the
/// conversation.
export function parseMentions(body: string): ParsedMentions {
  const usernames = new Set<string>();
  let mentionsEveryone = false;

  for (const match of body.matchAll(MENTION_PATTERN)) {
    const username = match[2];
    if (!username) continue;

    const lowered = username.toLowerCase();
    if (lowered === MENTION_ALL || lowered === 'channel' || lowered === 'everyone') {
      mentionsEveryone = true;
      continue;
    }
    usernames.add(lowered);
  }

  return { usernames: [...usernames], mentionsEveryone };
}

export interface SlashCommand {
  name: string;
  argument: string;
}

/// Recognises a leading slash command, e.g. "/task docker compose".
///
/// Only at the very start of a message: a URL or a code snippet containing a
/// slash mid-sentence must not be read as a command.
export function parseSlashCommand(body: string): SlashCommand | null {
  const match = /^\/([a-z][a-z0-9-]*)(?:\s+([\s\S]*))?$/i.exec(body.trim());
  if (!match) return null;

  return {
    name: (match[1] ?? '').toLowerCase(),
    argument: (match[2] ?? '').trim(),
  };
}

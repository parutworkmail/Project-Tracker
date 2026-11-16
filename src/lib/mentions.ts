export interface MentionUser {
  id: string;
  username: string;
  name: string | null;
}

export interface MentionPart {
  text: string;
  user?: MentionUser;
}

// "@" + a username, not glued to a word or to another "@" (so e-mail addresses
// such as bob@example.com are never read as tags).
const MENTION = /(?<![\w@.-])@([a-zA-Z0-9_.-]{3,32})/g;

function resolveHandle(
  candidate: string,
  users: MentionUser[]
): { user: MentionUser; used: string } | null {
  // "thanks @bob." must still find bob: retry without the trailing punctuation.
  for (const attempt of [candidate, candidate.replace(/[.-]+$/, "")]) {
    if (attempt.length < 3) continue;

    const exact = users.find((user) => user.username === attempt);
    if (exact) return { user: exact, used: attempt };

    const lower = attempt.toLowerCase();
    const loose = users.filter((user) => user.username.toLowerCase() === lower);
    if (loose.length === 1) return { user: loose[0], used: attempt };
  }

  return null;
}

// Cuts a comment into plain text and resolved @mentions, in reading order.
export function splitMentions(body: string, users: MentionUser[]): MentionPart[] {
  const parts: MentionPart[] = [];
  let cursor = 0;

  for (const match of body.matchAll(MENTION)) {
    const found = resolveHandle(match[1], users);
    if (!found) continue;

    const start = match.index ?? 0;
    const end = start + 1 + found.used.length;

    if (start > cursor) parts.push({ text: body.slice(cursor, start) });
    parts.push({ text: body.slice(start, end), user: found.user });
    cursor = end;
  }

  if (cursor < body.length) parts.push({ text: body.slice(cursor) });

  return parts;
}

export function findMentionedUsers(body: string, users: MentionUser[]): MentionUser[] {
  const byId = new Map<string, MentionUser>();

  for (const part of splitMentions(body, users)) {
    if (part.user) byId.set(part.user.id, part.user);
  }

  return [...byId.values()];
}

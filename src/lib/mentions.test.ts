import { describe, expect, it } from "vitest";

import { findMentionedUsers, splitMentions } from "@/lib/mentions";

const people = [
  { id: "1", username: "alice", name: "Alice A" },
  { id: "2", username: "bob.smith", name: null },
  { id: "3", username: "Carol", name: null },
];

describe("findMentionedUsers", () => {
  it("finds tagged people once each", () => {
    const found = findMentionedUsers("hi @alice and @bob.smith, @alice again", people);
    expect(found.map((user) => user.id)).toEqual(["1", "2"]);
  });

  it("ignores trailing punctuation after the name", () => {
    expect(findMentionedUsers("thanks @alice.", people).map((u) => u.id)).toEqual(["1"]);
    expect(findMentionedUsers("(@alice)", people).map((u) => u.id)).toEqual(["1"]);
  });

  it("matches case-insensitively when there is a single match", () => {
    expect(findMentionedUsers("ping @carol", people).map((u) => u.id)).toEqual(["3"]);
  });

  it("does not read e-mail addresses or unknown names as tags", () => {
    expect(findMentionedUsers("mail alice@example.com", people)).toEqual([]);
    expect(findMentionedUsers("@nobody here", people)).toEqual([]);
    expect(findMentionedUsers("@al", people)).toEqual([]);
  });
});

describe("splitMentions", () => {
  it("keeps every character of the comment, in order", () => {
    const body = "see @alice. ok @unknown @bob.smith!";
    const parts = splitMentions(body, people);

    expect(parts.map((part) => part.text).join("")).toBe(body);
    expect(parts.filter((part) => part.user).map((part) => part.text)).toEqual([
      "@alice",
      "@bob.smith",
    ]);
  });
});

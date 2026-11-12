import { describe, expect, it } from "vitest";

import { describeActivity } from "./issueMeta";

const names: Record<string, string> = { u1: "Ann", u2: "Bob" };
const nameOf = (id: string | null) => (id ? (names[id] ?? "?") : "nobody");

function entry(field: string | null, from: string | null, to: string | null, kind = "changed") {
  return { kind, field, old_value: from, new_value: to };
}

describe("describeActivity", () => {
  it("describes created and commented", () => {
    expect(describeActivity(entry(null, null, null, "created"), nameOf)).toBe("created this task");
    expect(describeActivity(entry(null, null, null, "commented"), nameOf)).toBe("added a comment");
  });

  it("uses human labels for status and priority", () => {
    expect(describeActivity(entry("status", "todo", "in_progress"), nameOf)).toBe(
      "changed the status from To do to In progress"
    );
    expect(describeActivity(entry("priority", "low", "urgent"), nameOf)).toBe(
      "changed the priority from Low to Urgent"
    );
  });

  it("handles due date set, changed and cleared", () => {
    expect(describeActivity(entry("due_date", null, "2027-03-01"), nameOf)).toBe(
      "set the due date to Mar 1, 2027"
    );
    expect(describeActivity(entry("due_date", "2027-03-01", "2027-03-05"), nameOf)).toBe(
      "changed the due date from Mar 1, 2027 to Mar 5, 2027"
    );
    expect(describeActivity(entry("due_date", "2027-03-01", null), nameOf)).toBe(
      "cleared the due date"
    );
  });

  it("handles assign, unassign and reassign", () => {
    expect(describeActivity(entry("assignee_id", null, "u1"), nameOf)).toBe("assigned this to Ann");
    expect(describeActivity(entry("assignee_id", "u1", null), nameOf)).toBe("unassigned Ann");
    expect(describeActivity(entry("assignee_id", "u1", "u2"), nameOf)).toBe(
      "reassigned this from Ann to Bob"
    );
  });

  it("covers title, description and unknown fields", () => {
    expect(describeActivity(entry("title", "A", "B"), nameOf)).toBe('renamed the task from "A" to "B"');
    expect(describeActivity(entry("description", null, null), nameOf)).toBe("updated the description");
    expect(describeActivity(entry("weird", null, null), nameOf)).toBe("updated the task");
  });
});

describe("describeActivity labels", () => {
  it("describes adding and removing a label", () => {
    expect(describeActivity(entry("label", null, "Bug"), nameOf)).toBe('added the label "Bug"');
    expect(describeActivity(entry("label", "Bug", null), nameOf)).toBe('removed the label "Bug"');
  });
});

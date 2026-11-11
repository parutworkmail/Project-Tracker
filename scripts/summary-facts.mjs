// Prints the verified facts needed for the daily-summary infographic.
//   node scripts/summary-facts.mjs            -> git facts only (instant)
//   node scripts/summary-facts.mjs --checks   -> also runs tsc, eslint, vitest (about 30s)
// Every number the infographic shows must come from this output or from a command run
// in the same session. It never touches a database.
import { spawnSync } from "node:child_process";

function run(command) {
  const result = spawnSync(command, { shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { code: result.status, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

const status = run("git status --porcelain -uall").out.split("\n").filter(Boolean);
const facts = {
  generatedAt: new Date().toISOString(),
  git: {
    totalFilesChangedOrAdded: status.length,
    modified: status.filter((l) => l.startsWith(" M") || l.startsWith("M ")).length,
    newUntracked: status.filter((l) => l.startsWith("??")).length,
    deleted: status.filter((l) => l.includes("D ")).length,
    lastCommit: run("git log -1 --format=%h%x20%s").out.trim(),
  },
  note: "Database checks: say 'local test Postgres' or 'your Supabase' for each one. Only Supabase is 'real'.",
};

if (process.argv.includes("--checks")) {
  const tsc = run("npx tsc --noEmit");
  facts.typecheck = tsc.code === 0 ? "clean" : `FAILED (${tsc.out.split("\n").filter((l) => l.includes("error")).length} errors)`;

  const lint = run("npx eslint src");
  const lintErrors = /(\d+) errors?/.exec(lint.out);
  facts.lint = lint.code === 0 ? "clean" : `exit ${lint.code}${lintErrors ? `, ${lintErrors[1]} errors` : ""}`;

  const tests = run("npx vitest run");
  // eslint-disable-next-line no-control-regex
  const plain = tests.out.replace(/\x1b\[[0-9;]*m/g, "");
  const passed = /Tests\s+(?:(\d+) failed \| )?(\d+) passed(?: \| (\d+) skipped)?/.exec(plain);
  facts.unitTests = passed
    ? { failed: Number(passed[1] ?? 0), passed: Number(passed[2]), skipped: Number(passed[3] ?? 0) }
    : "could not parse vitest output";
}

console.log(JSON.stringify(facts, null, 2));

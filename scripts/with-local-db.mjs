// Runs a command with env vars pointing at the throwaway local test database.
//   node scripts/with-local-db.mjs <command> [args...]
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const localDb = fileURLToPath(new URL("./local-db.mjs", import.meta.url));
const env = JSON.parse(
  execFileSync(process.execPath, [localDb, "env"], { encoding: "utf8" })
);

const [command, ...args] = process.argv.slice(2);
const child = spawn(command, args, {
  stdio: "inherit",
  shell: ["npx", "npm"].includes(command),
  env: {
    ...process.env,
    ...env,
    AUTH_SECRET: process.env.AUTH_SECRET ?? "local-test-secret",
    AUTH_TRUST_HOST: "true",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));

// Runs a command with env vars pointing at the throwaway local test database.
//   node scripts/with-local-db.mjs <command> [args...]
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const localDb = fileURLToPath(new URL("./local-db.mjs", import.meta.url));
const env = JSON.parse(
  execFileSync(process.execPath, [localDb, "env"], { encoding: "utf8" })
);

const [command, ...args] = process.argv.slice(2);
const needsShell = ["npx", "npm"].includes(command);

// A shell is needed to run npm/npx on Windows. Node warns (DEP0190) when an args
// array is combined with a shell, so build one quoted command line instead.
const quote = (value) => (/^[\w./:=@%+,-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`);

const options = {
  stdio: "inherit",
  env: {
    ...process.env,
    ...env,
    AUTH_SECRET: process.env.AUTH_SECRET ?? "local-test-secret",
    AUTH_TRUST_HOST: "true",
  },
};

const child = needsShell
  ? spawn([command, ...args].map(quote).join(" "), { ...options, shell: true })
  : spawn(command, args, options);

child.on("exit", (code) => process.exit(code ?? 0));

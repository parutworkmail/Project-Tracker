// Throwaway local Postgres for testing when the cloud database is unreachable.
// Uses the installed PostgreSQL binaries in a private temp data directory on its own port;
// it never touches the installed service or any real data.
//   node scripts/local-db.mjs start   -> init (first time), start, create db, apply migrations
//   node scripts/local-db.mjs stop
//   node scripts/local-db.mjs env     -> print the env vars to point the app/scripts at it
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BIN = "C:/Program Files/PostgreSQL/17/bin";
const DATA = path.join(os.tmpdir(), "tracker-local-pg");
const PORT = 5544;
const DB = "tracker";

const exe = (name) => path.join(BIN, `${name}.exe`);
const run = (name, args, opts = {}) =>
  execFileSync(exe(name), args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });

function isRunning() {
  const r = spawnSync(exe("pg_ctl"), ["status", "-D", DATA], { encoding: "utf8" });
  return r.status === 0;
}

const cmd = process.argv[2];

if (cmd === "start") {
  if (!fs.existsSync(path.join(DATA, "PG_VERSION"))) {
    run("initdb", ["-D", DATA, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--locale=C"]);
    console.log("initialised", DATA);
  }
  if (!isRunning()) {
    run("pg_ctl", ["start", "-D", DATA, "-o", `-p ${PORT} -c listen_addresses=127.0.0.1`, "-l", path.join(DATA, "server.log"), "-w", "-t", "60"]);
    console.log("started on port", PORT);
  }
  const exists = run("psql", ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname='${DB}'`]).trim();
  if (exists !== "1") {
    run("createdb", ["-h", "127.0.0.1", "-p", String(PORT), "-U", "postgres", DB]);
    console.log("created database", DB);
  }
  console.log("ready: postgresql://postgres@127.0.0.1:" + PORT + "/" + DB);
} else if (cmd === "stop") {
  if (isRunning()) {
    run("pg_ctl", ["stop", "-D", DATA, "-m", "fast", "-w"]);
    console.log("stopped");
  } else console.log("not running");
} else if (cmd === "env") {
  console.log(
    JSON.stringify({
      SUPABASE_DB_HOST: "127.0.0.1",
      SUPABASE_DB_PORT: String(PORT),
      SUPABASE_DB_USER: "postgres",
      SUPABASE_DB_PASSWORD: "local",
      SUPABASE_DB_NAME: DB,
      SUPABASE_DB_SSL: "disable",
      DATABASE_URL: `postgresql://postgres@127.0.0.1:${PORT}/${DB}`,
      DIRECT_URL: `postgresql://postgres@127.0.0.1:${PORT}/${DB}`,
    })
  );
} else {
  console.log("usage: node scripts/local-db.mjs start|stop|env");
}

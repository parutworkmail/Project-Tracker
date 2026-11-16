// Removes exactly the users and projects listed in docs/test-data/manifest.json
// (written by scripts/e2e-loop.mjs). Nothing else is touched.
//   node scripts/with-local-db.mjs node scripts/test-data-cleanup.mjs          -> dry run, lists what would go
//   node scripts/with-local-db.mjs node scripts/test-data-cleanup.mjs --yes    -> deletes
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "docs", "test-data", "manifest.json");
const confirmed = process.argv.includes("--yes");

if (!fs.existsSync(manifestPath)) {
  console.log("No manifest found, nothing to clean up.");
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const target = `${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT}/${process.env.SUPABASE_DB_NAME}`;

console.log(`manifest database : ${manifest.database}`);
console.log(`connected database: ${target}`);
console.log(`users   (${manifest.users.length}): ${manifest.users.map((u) => u.username).join(", ")}`);
console.log(`projects(${manifest.projects.length}): ${manifest.projects.map((p) => p.slug).join(", ")}`);

if (manifest.database !== target) {
  console.error("\nRefusing to continue: the manifest was created on a different database than the one this run points at.");
  process.exit(1);
}

if (!confirmed) {
  console.log("\nDry run. Re-run with --yes to delete the items above.");
  process.exit(0);
}

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: process.env.SUPABASE_DB_SSL === "disable" ? false : { rejectUnauthorized: false },
});

await client.connect();

let projectsRemoved = 0;
for (const project of manifest.projects) {
  if (/^proj_[a-f0-9]{32}$/.test(project.schemaName)) {
    await client.query(`DROP SCHEMA IF EXISTS "${project.schemaName}" CASCADE`);
  }
  const res = await client.query(`DELETE FROM "Project" WHERE id = $1`, [project.id]);
  projectsRemoved += res.rowCount ?? 0;
}

const userIds = manifest.users.map((u) => u.id);
const usernames = manifest.users.map((u) => u.username);
const audit = await client.query(
  `DELETE FROM "AuditLog" WHERE "actorId" = ANY($1) OR "actorName" = ANY($2)`,
  [userIds, usernames]
);
const users = await client.query(`DELETE FROM "User" WHERE id = ANY($1)`, [userIds]);
await client.query(`DELETE FROM "RateLimitEntry" WHERE key LIKE 'login:%'`);
await client.end();

fs.renameSync(manifestPath, manifestPath.replace(/\.json$/, `.cleaned-${Date.now()}.json`));
console.log(`\nremoved ${projectsRemoved} project(s), ${users.rowCount} user(s), ${audit.rowCount} audit row(s). Manifest archived.`);

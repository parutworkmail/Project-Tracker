import pg from "pg";

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: process.env.SUPABASE_DB_SSL === "disable" ? false : { rejectUnauthorized: false, ecdhCurve: "X25519:prime256v1:secp384r1" },
});

await client.connect();
const projects = await client.query(
  `SELECT p.id, p."schemaName" FROM "Project" p JOIN "User" u ON u.id = p."createdById" WHERE u.username LIKE 'e2e\_%' ESCAPE '\'`
);
for (const row of projects.rows) {
  if (/^proj_[a-f0-9]{32}$/.test(row.schemaName)) {
    await client.query(`DROP SCHEMA IF EXISTS "${row.schemaName}" CASCADE`);
  }
  await client.query(`DELETE FROM "Project" WHERE id = $1`, [row.id]);
}
const users = await client.query(
  `DELETE FROM "User" WHERE username LIKE 'e2e\_%' ESCAPE '\' RETURNING username`
);
await client.query(`DELETE FROM "RateLimitEntry" WHERE key LIKE 'login:%'`);
console.log(`removed ${projects.rowCount} project(s), ${users.rowCount} user(s), login rate-limit rows cleared`);
await client.end();

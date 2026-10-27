export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function randomSuffix(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function buildUniqueSlug(name: string): string {
  const base = slugify(name) || "project";
  return `${base}-${randomSuffix()}`;
}

// Every top-level static route segment under src/app — a project's slug
// becomes a root-level URL (e.g. /{slug}), so it must never collide with
// one of these or that project becomes permanently unreachable (Next.js
// always prefers a static route over the dynamic [slug] catch-all).
export const RESERVED_SLUGS = new Set([
  "admin",
  "admin-project",
  "dashboard",
  "login",
  "change-password",
  "api",
  "project",
  "projects",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

// One place that decides how the running version is written, so the footer, the
// changelog and the git tag stay in step: package.json "version" = git tag "v<version>".
export const RELEASE_STAGE = "alpha";

export function formatVersion(version: string | undefined, commit?: string): string {
  const base = version ? `v${version}` : "dev";
  return commit ? `${base} · ${commit}` : base;
}

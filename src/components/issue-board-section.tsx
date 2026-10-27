import { listIssues } from "@/lib/projectSchema";
import { IssueTable } from "@/components/issue-table";

export async function IssueBoardSection({
  slug,
  schemaName,
  canManage,
}: {
  slug: string;
  schemaName: string;
  canManage: boolean;
}) {
  const issues = await listIssues(schemaName);

  return <IssueTable slug={slug} issues={issues} canManage={canManage} />;
}

import { PageLoading } from "@/components/page-loading";

// Fallback for every page in the main site that has no loading screen of its own
// (My tasks, Create user, Change password, ...). Pages with their own
// loading.tsx (dashboard, admin) keep it.
export default function Loading() {
  return <PageLoading />;
}

import { createFileRoute, Navigate } from '@tanstack/react-router';
import { NotFound } from '@/features/shared/ui/feedback';
import { getLegacyTopicCanonicalRoute } from '@/features/docs/logic/docsRegistry';

export const Route = createFileRoute('/docs/$topic')({
  component: DocsTopicRoute,
});

function DocsTopicRoute() {
  const { topic } = Route.useParams();
  const canonicalRoute = getLegacyTopicCanonicalRoute(topic);

  return canonicalRoute ? <Navigate to={canonicalRoute as never} replace /> : <NotFound />;
}

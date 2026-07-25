import { createFileRoute } from '@tanstack/react-router';
import { DocsContentPage } from '@/features/docs/DocsContentPage';

export const Route = createFileRoute('/docs/getting-started/$slug')({
  component: GettingStartedDocsRoute,
});

function GettingStartedDocsRoute() {
  const { slug } = Route.useParams();
  return <DocsContentPage kind="getting-started" slug={slug} />;
}

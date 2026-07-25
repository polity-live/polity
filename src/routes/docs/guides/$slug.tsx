import { createFileRoute } from '@tanstack/react-router';
import { DocsContentPage } from '@/features/docs/DocsContentPage';

export const Route = createFileRoute('/docs/guides/$slug')({
  component: GuideDocsRoute,
});

function GuideDocsRoute() {
  const { slug } = Route.useParams();
  return <DocsContentPage kind="guide" slug={slug} />;
}

import { createFileRoute } from '@tanstack/react-router';
import { DocsSearchPage } from '@/features/docs/DocsSearchPage';

export const Route = createFileRoute('/docs/search')({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : '',
  }),
  component: DocsSearchRoute,
});

function DocsSearchRoute() {
  const { q } = Route.useSearch();
  return <DocsSearchPage initialQuery={q} />;
}

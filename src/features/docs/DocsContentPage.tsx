import { NotFound } from '@/features/shared/ui/feedback';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { getDocsPage } from './logic/docsRegistry';
import type { DocsPageKind } from './types/docs.types';
import { DocsArticle } from './ui/DocsArticle';

export function DocsContentPage({ kind, slug }: { kind: DocsPageKind; slug: string }) {
  const { language } = useTranslation();
  const page = getDocsPage(slug, language, kind);

  if (!page) return <NotFound />;
  return <DocsArticle page={page} />;
}

import { useTranslation } from '@/features/shared/hooks/use-translation';

import { useDocsLandingPage } from './hooks/useDocsPage';
import { DocsLandingView } from './ui/DocsLandingView';

export function DocsLandingPage() {
  const { t } = useTranslation();
  const { featuredTopics, categorySections } = useDocsLandingPage();

  return (
    <DocsLandingView
      featuredTopics={featuredTopics}
      categorySections={categorySections}
      copy={{
        title: t('pages.docs.overview.title'),
        subtitle: t('pages.docs.overview.subtitle'),
        primaryCta: t('pages.docs.overview.primaryCta'),
        secondaryCta: t('pages.docs.overview.secondaryCta'),
        pathwaysTitle: t('pages.docs.overview.pathwaysTitle'),
        pathways: ['start', 'coordinate', 'decide', 'follow-through'].map(item =>
          t(`pages.docs.overview.pathways.${item}`)
        ),
        featuredTitle: t('pages.docs.overview.featuredTitle'),
        featuredDescription: t('pages.docs.overview.featuredDescription'),
        libraryTitle: t('pages.docs.overview.libraryTitle'),
        libraryDescription: t('pages.docs.overview.libraryDescription'),
      }}
    />
  );
}

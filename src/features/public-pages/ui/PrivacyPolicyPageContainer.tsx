import {
  LegalInfoPageView,
  type LegalInfoRelatedLink,
  type LegalInfoSectionViewModel,
} from '@/features/public-pages/ui/LegalInfoPageView';
import { useTranslation } from '@/features/shared/hooks/use-translation';

const sectionKeys = ['overview', 'dataCollection', 'usage', 'sharing', 'security'] as const;

export function PrivacyPolicyPageContainer() {
  const { t, tArray } = useTranslation();

  const sections: LegalInfoSectionViewModel[] = sectionKeys.map(key => ({
    key,
    title: t(`pages.privacy.sections.${key}.title`),
    paragraphs: tArray(`pages.privacy.sections.${key}.paragraphs`).filter(
      (paragraph): paragraph is string => typeof paragraph === 'string'
    ),
    items: tArray(`pages.privacy.sections.${key}.items`).filter(
      (item): item is string => typeof item === 'string'
    ),
  }));

  const relatedLinks: LegalInfoRelatedLink[] = [
    {
      to: '/terms-and-conditions',
      title: t('pages.privacy.related.terms.title'),
      description: t('pages.privacy.related.terms.description'),
    },
    {
      to: '/imprint',
      title: t('pages.privacy.related.imprint.title'),
      description: t('pages.privacy.related.imprint.description'),
    },
    {
      to: '/support',
      title: t('pages.privacy.related.support.title'),
      description: t('pages.privacy.related.support.description'),
    },
  ];

  return (
    <LegalInfoPageView
      title={t('pages.privacy.title')}
      subtitle={t('pages.privacy.subtitle')}
      lastUpdated={t('pages.privacy.lastUpdated')}
      sections={sections}
      relatedTitle={t('pages.privacy.related.title')}
      relatedDescription={t('pages.privacy.related.description')}
      relatedLinks={relatedLinks}
    />
  );
}

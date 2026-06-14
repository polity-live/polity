import {
  LegalInfoPageView,
  type LegalInfoRelatedLink,
  type LegalInfoSectionViewModel,
} from '@/features/public-pages/ui/LegalInfoPageView';
import { useTranslation } from '@/features/shared/hooks/use-translation';

const sectionKeys = [
  'scope',
  'accounts',
  'acceptableUse',
  'content',
  'availability',
  'liability',
  'changes',
] as const;

export function TermsPageContainer() {
  const { t, tArray } = useTranslation();

  const sections: LegalInfoSectionViewModel[] = sectionKeys.map(key => ({
    key,
    title: t(`pages.terms.sections.${key}.title`),
    paragraphs: tArray(`pages.terms.sections.${key}.paragraphs`).filter(
      (paragraph): paragraph is string => typeof paragraph === 'string'
    ),
    items: tArray(`pages.terms.sections.${key}.items`).filter(
      (item): item is string => typeof item === 'string'
    ),
  }));

  const relatedLinks: LegalInfoRelatedLink[] = [
    {
      to: '/privacy-policy',
      title: t('pages.terms.related.privacy.title'),
      description: t('pages.terms.related.privacy.description'),
    },
    {
      to: '/imprint',
      title: t('pages.terms.related.imprint.title'),
      description: t('pages.terms.related.imprint.description'),
    },
    {
      to: '/auth',
      title: t('pages.terms.related.auth.title'),
      description: t('pages.terms.related.auth.description'),
    },
  ];

  return (
    <LegalInfoPageView
      title={t('pages.terms.title')}
      subtitle={t('pages.terms.subtitle')}
      lastUpdated={t('pages.terms.lastUpdated')}
      sections={sections}
      relatedTitle={t('pages.terms.related.title')}
      relatedDescription={t('pages.terms.related.description')}
      relatedLinks={relatedLinks}
    />
  );
}

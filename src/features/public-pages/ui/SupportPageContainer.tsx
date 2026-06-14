import {
  SupportPageView,
  type SupportAreaViewModel,
} from '@/features/public-pages/ui/SupportPageView';
import { GITHUB_REPOSITORY_URL } from '@/features/shared/constants';
import { useTranslation } from '@/features/shared/hooks/use-translation';

const areaKeys = ['financial', 'design', 'development'] as const;

const areaCtaLinks: Record<(typeof areaKeys)[number], { href: string; external?: boolean }> = {
  financial: { href: '/pricing' },
  design: {
    href: 'https://www.figma.com/proto/cAT8Aonu8P7ojwgnKcVlkz/Polity?node-id=51357-32189&starting-point-node-id=51098%3A4683',
    external: true,
  },
  development: { href: GITHUB_REPOSITORY_URL, external: true },
};

export function SupportPageContainer() {
  const { t, tArray } = useTranslation();

  const areas: SupportAreaViewModel[] = areaKeys.map(key => ({
    key,
    icon: key,
    title: t(`pages.support.areas.${key}.title`),
    description: t(`pages.support.areas.${key}.description`),
    details: tArray(`pages.support.areas.${key}.details`).filter(
      (detail): detail is string => typeof detail === 'string'
    ),
    cta: t(`pages.support.areas.${key}.cta`),
    ...areaCtaLinks[key],
  }));

  return (
    <SupportPageView
      title={t('pages.support.header.title')}
      subtitle={t('pages.support.header.subtitle')}
      howCanHelp={t('pages.support.howCanHelp')}
      areas={areas}
      communityTitle={t('pages.support.community.title')}
      communityDescription={t('pages.support.community.description')}
      getStartedLabel={t('pages.home.hero.getStarted')}
    />
  );
}

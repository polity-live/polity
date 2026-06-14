import { featureThemeClassName } from '@/features/shared/theme';
import type { NavigationItem } from '@/features/navigation/types/navigation.types.tsx';
import { docsTopicDefinitions } from '@/features/docs/logic/docsTopics.ts';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

// TanStack Router navigate function type
type NavigateFn = (opts: { to: string; hash?: string }) => void;

// This function factory creates unauthenticated navigation items with router integration
export const createNavItemsUnauthenticated = (
  navigate: NavigateFn,
  t?: (key: string) => string // Optional translation function
): NavigationItem[] => {
  return [
    {
      id: 'home',
      icon: 'Home',
      label: t ? t('navigation.primary.home') : 'Home',
      href: '/#home',
      onClick: () => navigate({ to: '/', hash: 'home' }),
    },
    {
      id: 'docs',
      icon: 'BookOpen',
      label: t ? t('navigation.primary.docs') : 'Docs',
      href: '/docs',
      onClick: () => navigate({ to: '/docs' }),
    },
    {
      id: 'pricing',
      icon: 'CreditCard',
      label: t ? t('navigation.primary.pricing') : 'Pricing',
      href: '/pricing',
      onClick: () => navigate({ to: '/pricing' }),
    },
    {
      id: 'support',
      icon: 'Heart',
      label: t ? t('navigation.primary.support') : 'Support',
      href: '/support',
      onClick: () => navigate({ to: '/support' }),
    },
    {
      id: 'auth',
      icon: 'User',
      label: translateText('generated.inline.0192_login_4e5a2893'),
      href: '/auth',
      onClick: () => navigate({ to: '/auth' }),
    },
  ];
};

export const createLandingSecondaryNavItems = (
  navigate: NavigateFn,
  t?: (key: string) => string
): NavigationItem[] => {
  return [
    {
      id: 'landing-home',
      icon: 'Home',
      label: t ? t('pages.home.publicLanding.nav.home') : 'Home',
      href: '/#home',
      onClick: () => navigate({ to: '/', hash: 'home' }),
    },
    {
      id: 'landing-features',
      icon: 'Sparkles',
      label: t ? t('pages.home.publicLanding.nav.features') : 'Features',
      href: featureThemeClassName('navigationNavItemsUnauthenticatedThemedStyle'),
      onClick: () => navigate({ to: '/', hash: 'features' }),
    },
    {
      id: 'landing-solutions',
      icon: 'Target',
      label: t ? t('pages.home.publicLanding.nav.solutions') : 'Solutions',
      href: '/#solutions',
      onClick: () => navigate({ to: '/', hash: 'solutions' }),
    },
    {
      id: 'landing-imprint',
      icon: 'FileText',
      label: t ? t('pages.home.publicLanding.nav.imprint') : 'Imprint',
      href: '/#imprint',
      onClick: () => navigate({ to: '/', hash: 'imprint' }),
    },
  ];
};

export const createDocsSecondaryNavItems = (
  navigate: NavigateFn,
  t?: (key: string) => string
): NavigationItem[] => {
  return [
    {
      id: 'docs-overview',
      icon: 'BookOpen',
      label: t ? t('pages.docs.overview.navLabel') : 'Overview',
      href: '/docs',
      onClick: () => navigate({ to: '/docs' }),
    },
    ...docsTopicDefinitions.map(topic => ({
      id: `docs-${topic.slug}`,
      icon: topic.icon,
      label: t ? t(`pages.docs.topics.${topic.slug}.navLabel`) : topic.slug,
      href: `/docs/${topic.slug}`,
      onClick: () => navigate({ to: `/docs/${topic.slug}` }),
    })),
  ];
};

// Backward compatibility - static version for contexts where hooks can't be used
export const navItemsUnauthenticated: NavigationItem[] = [
  {
    id: 'home',
    icon: 'Home',
    label: translateText('generated.inline.0186_home_70f8bb9a'),
    href: '/#home',
  },
  {
    id: 'docs',
    icon: 'BookOpen',
    label: translateText('generated.inline.0193_docs_68a41942'),
    href: '/docs',
  },
  {
    id: 'pricing',
    icon: 'CreditCard',
    label: translateText('generated.inline.0194_pricing_a0d9bbad'),
    href: '/pricing',
  },
  {
    id: 'support',
    icon: 'Heart',
    label: translateText('generated.inline.0083_support_f32d5a3b'),
    href: '/support',
  },
  {
    id: 'auth',
    icon: 'User',
    label: translateText('generated.inline.0192_login_4e5a2893'),
    href: '/auth',
  },
];

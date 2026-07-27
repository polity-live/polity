import type { NavigationItem } from '@/features/navigation/types/navigation.types.tsx';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { isGuestAccessibleEntityPath } from '@/features/auth/logic/guestEntityRouteAccess';
import { navItemsAuthenticated } from './nav-items-authenticated';

// TanStack Router navigate function type
type NavigateFn = (opts: { to: string; hash?: string }) => void;

// This function factory creates unauthenticated navigation items with router integration
export const createNavItemsUnauthenticated = (
  navigate: NavigateFn,
  t?: (key: string) => string // Optional translation function
): NavigationItem[] => {
  const translate = t ?? translateText;
  return [
    {
      id: 'home',
      icon: 'Home',
      label: translate('navigation.primary.home'),
      href: '/#home',
      onClick: () => navigate({ to: '/', hash: 'home' }),
    },
    {
      id: 'docs',
      icon: 'BookOpen',
      label: translate('navigation.primary.docs'),
      href: '/docs',
      onClick: () => navigate({ to: '/docs' }),
    },
    {
      id: 'pricing',
      icon: 'CreditCard',
      label: translate('navigation.primary.pricing'),
      href: '/pricing',
      onClick: () => navigate({ to: '/pricing' }),
    },
    {
      id: 'support',
      icon: 'Heart',
      label: translate('navigation.primary.support'),
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
  const translate = t ?? translateText;
  return [
    {
      id: 'landing-home',
      icon: 'Home',
      label: translate('pages.home.publicLanding.nav.home'),
      href: '/#home',
      onClick: () => navigate({ to: '/', hash: 'home' }),
    },
    {
      id: 'landing-features',
      icon: 'Sparkles',
      label: translate('pages.home.publicLanding.nav.features'),
      href: '/#features',
      onClick: () => navigate({ to: '/', hash: 'features' }),
    },
    {
      id: 'landing-solutions',
      icon: 'Target',
      label: translate('pages.home.publicLanding.nav.solutions'),
      href: '/#solutions',
      onClick: () => navigate({ to: '/', hash: 'solutions' }),
    },
    {
      id: 'landing-imprint',
      icon: 'FileText',
      label: translate('pages.home.publicLanding.nav.imprint'),
      href: '/#imprint',
      onClick: () => navigate({ to: '/', hash: 'imprint' }),
    },
  ];
};

export const createEntitySecondaryNavItemsUnauthenticated = (
  pathname: string,
  navigate: NavigateFn,
  t?: (key: string) => string
): NavigationItem[] | null => {
  const navItems = navItemsAuthenticated(navigate, t);
  const groupBlogMatch = pathname.match(/^\/group\/([^/]+)\/blog\/([^/]+)/);
  const userBlogMatch = pathname.match(/^\/user\/([^/]+)\/blog\/([^/]+)/);
  const directBlogMatch = pathname.match(/^\/blog\/([^/]+)/);
  const eventMatch = pathname.match(/^\/event\/([^/]+)/);
  const userMatch = pathname.match(/^\/user\/([^/]+)/);
  const groupMatch = pathname.match(/^\/group\/([^/]+)/);
  const amendmentMatch = pathname.match(/^\/amendment\/([^/]+)/);

  let items: NavigationItem[] | null = null;

  if (groupBlogMatch) {
    items = navItems.getBlogSecondaryNavItems(groupBlogMatch[2], false, false, groupBlogMatch[1]);
  } else if (userBlogMatch) {
    items = navItems.getBlogSecondaryNavItems(
      userBlogMatch[2],
      false,
      false,
      undefined,
      userBlogMatch[1]
    );
  } else if (directBlogMatch) {
    items = navItems.getBlogSecondaryNavItems(directBlogMatch[1]);
  } else if (eventMatch) {
    items = navItems.getEventSecondaryNavItems(eventMatch[1]);
  } else if (userMatch) {
    items = navItems.getUserSecondaryNavItems(userMatch[1], false);
  } else if (groupMatch) {
    items = navItems.getGroupSecondaryNavItems(groupMatch[1]);
  } else if (amendmentMatch) {
    items = navItems.getAmendmentSecondaryNavItems(amendmentMatch[1], true);
  }

  if (!items) {
    return null;
  }

  return items.filter(item => item.href && isGuestAccessibleEntityPath(item.href));
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

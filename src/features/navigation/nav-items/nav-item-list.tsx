import type {
  NavigationItem,
  NavigationView,
} from '@/features/navigation/types/navigation.types.tsx';
import React, { useState } from 'react';
import { useLocation, useRouterState } from '@tanstack/react-router';
import { NavItemListView } from './NavItemListView';

const LANDING_SECTION_FALLBACK_SCROLL_MARGIN_TOP = 96;
const LANDING_PATHS = new Set(['/', '/features', '/solutions', '/imprint']);

function normalizePathname(pathname?: string): string {
  if (!pathname) return '/';
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function decodeHashSectionId(sectionId: string): string {
  try {
    return decodeURIComponent(sectionId);
  } catch {
    return sectionId;
  }
}

function isSameLandingHashPath(targetPathname: string, currentPathname: string): boolean {
  return (
    targetPathname === currentPathname ||
    (targetPathname === '/' && LANDING_PATHS.has(currentPathname))
  );
}

function getSamePageHashSectionId(
  href: string | undefined,
  currentPathname: string
): string | null {
  if (!href) return null;

  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) return null;

  const sectionId = href.slice(hashIndex + 1);
  if (!sectionId) return null;

  const hrefPath = href.slice(0, hashIndex).split('?')[0];
  const targetPathname = normalizePathname(hrefPath || currentPathname);

  if (!isSameLandingHashPath(targetPathname, currentPathname)) {
    return null;
  }

  return decodeHashSectionId(sectionId);
}

function getNormalizedHashSectionId(normalizedHash: string): string | null {
  if (!normalizedHash.startsWith('#')) return null;
  const sectionId = normalizedHash.slice(1);
  return sectionId ? decodeHashSectionId(sectionId) : null;
}

function getSectionScrollMarginTop(section: HTMLElement): number {
  const scrollMarginTop = Number.parseFloat(window.getComputedStyle(section).scrollMarginTop);
  return Number.isFinite(scrollMarginTop)
    ? scrollMarginTop
    : LANDING_SECTION_FALLBACK_SCROLL_MARGIN_TOP;
}

function useActiveHashSectionRoute({
  enabled,
  navigationItems,
  normalizedHash,
  pathname,
}: {
  enabled: boolean;
  navigationItems: NavigationItem[];
  normalizedHash: string;
  pathname?: string;
}): string | null {
  const currentPathname = normalizePathname(pathname);
  const sectionIds = React.useMemo(
    () =>
      navigationItems
        .map(item => getSamePageHashSectionId(item.href, currentPathname))
        .filter((sectionId): sectionId is string => Boolean(sectionId)),
    [currentPathname, navigationItems]
  );
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled || sectionIds.length === 0) {
      setActiveSectionId(null);
      return;
    }

    const hashSectionId = getNormalizedHashSectionId(normalizedHash);
    if (hashSectionId && sectionIds.includes(hashSectionId)) {
      setActiveSectionId(hashSectionId);
      return;
    }

    setActiveSectionId(activeId =>
      activeId && sectionIds.includes(activeId) ? activeId : (sectionIds[0] ?? null)
    );
  }, [enabled, normalizedHash, sectionIds]);

  React.useEffect(() => {
    if (!enabled || sectionIds.length === 0) return;

    let animationFrameId = 0;

    const updateActiveSection = () => {
      animationFrameId = 0;

      const sections = sectionIds
        .map(sectionId => document.getElementById(sectionId))
        .filter((section): section is HTMLElement => Boolean(section));

      if (sections.length === 0) return;

      const scrollTop = window.scrollY;
      const activationOffset = getSectionScrollMarginTop(sections[0]) + 1;
      const activationLine = scrollTop + activationOffset;
      let nextActiveSectionId = sections[0].id;

      for (const section of sections) {
        const sectionTop = section.getBoundingClientRect().top + scrollTop;
        if (sectionTop <= activationLine) {
          nextActiveSectionId = section.id;
        } else {
          break;
        }
      }

      setActiveSectionId(nextActiveSectionId);
    };

    const requestUpdate = () => {
      if (animationFrameId) return;
      animationFrameId = window.requestAnimationFrame(updateActiveSection);
    };

    requestUpdate();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, [enabled, sectionIds]);

  if (!enabled || sectionIds.length === 0 || !activeSectionId) {
    return null;
  }

  return `/#${activeSectionId}`;
}

export function NavItemList({
  navigationItems,
  isMobile,
  isPrimary,
  navigationView,
}: {
  navigationItems: NavigationItem[];
  isMobile: boolean;
  isPrimary: boolean;
  navigationView: NavigationView;
}) {
  const { pathname, hash } = useLocation();
  const isRouterPending = useRouterState({ select: s => s.status === 'pending' });
  const normalizedHash = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';
  const activeHashSectionRoute = useActiveHashSectionRoute({
    enabled: !isPrimary,
    navigationItems,
    normalizedHash,
    pathname,
  });
  const currentRoute = activeHashSectionRoute ?? `${pathname ?? '/'}${normalizedHash}`;
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [loadingItem, setLoadingItem] = useState<string | null>(null);

  // Clear loading state when router finishes navigating
  React.useEffect(() => {
    if (!isRouterPending && loadingItem) {
      setLoadingItem(null);
    }
  }, [isRouterPending, loadingItem]);

  const handleItemClick = (item: NavigationItem) => {
    setLoadingItem(item.id);
    if (item.onClick) {
      item.onClick();
    }
    setHoveredItem(null);
  };
  return (
    <NavItemListView
      navigationItems={navigationItems}
      isMobile={isMobile}
      isPrimary={isPrimary}
      navigationView={navigationView}
      pathname={pathname}
      hash={hash}
      isRouterPending={isRouterPending}
      normalizedHash={normalizedHash}
      currentRoute={currentRoute}
      hoveredItem={hoveredItem}
      setHoveredItem={setHoveredItem}
      loadingItem={loadingItem}
      setLoadingItem={setLoadingItem}
      handleItemClick={handleItemClick}
    />
  );
}

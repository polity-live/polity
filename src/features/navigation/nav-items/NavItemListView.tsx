import { featureThemeClassName, getMotionPreset } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button, buttonVariants } from '@/features/shared/ui/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip.tsx';
import { cn } from '@/features/shared/utils/utils.ts';
import { iconMap } from '@/features/navigation/nav-items/icon-map.tsx';
import {
  commandDialogShortcut,
  getShortcutForItem,
} from '@/features/navigation/nav-keyboard/keyboard-navigation.ts';
import type { KeyboardShortcutDefinition } from '@/features/shared/keyboard/keyboard-shortcut';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import React from 'react';
import { Link } from '@tanstack/react-router';
import { isItemActive } from './nav-helpers.ts';
import { Loader2 } from 'lucide-react';
import type { ScreenType } from '@/features/navigation/types/navigation.types';

export interface NavItemListViewProps {
  navigationItems: any;
  isMobile: any;
  isPrimary: any;
  navigationView: any;
  screenType: ScreenType;
  pathname: any;
  hash: any;
  isRouterPending: any;
  normalizedHash: any;
  currentRoute: any;
  loadingItem: any;
  setLoadingItem: any;
  handleItemClick: any;
}

function NavigationItemTooltip({
  children,
  enabled,
  label,
  shortcut,
  side,
}: {
  children: React.ReactElement;
  enabled: boolean;
  label: string;
  shortcut?: KeyboardShortcutDefinition;
  side: React.ComponentProps<typeof TooltipContent>['side'];
}) {
  if (!enabled) return children;

  return (
    <Tooltip shortcut={shortcut}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

function NavigationItemIcon({ item, className }: { item: any; className: string }) {
  const Icon = iconMap[item.icon as keyof typeof iconMap];
  const badge = typeof item.badge === 'number' && item.badge > 0 ? item.badge : undefined;
  const badgeLabel = badge !== undefined && badge > 99 ? '99+' : badge;

  return (
    <span data-slot="navigation-item-icon" className="relative inline-flex shrink-0">
      {React.createElement(Icon, { className })}
      {badge !== undefined && (
        <BadgeControl
          aria-hidden="true"
          data-slot="navigation-item-badge"
          className="ring-background pointer-events-none absolute top-0 right-0 flex h-4 min-w-4 translate-x-[65%] -translate-y-[55%] items-center justify-center px-0.5 py-0 leading-none tabular-nums ring-2"
          shape="pill"
          size="tiny"
          variant="default"
        >
          {badgeLabel}
        </BadgeControl>
      )}
    </span>
  );
}

function tutorialAnchor(item: any, isPrimary: boolean): string {
  if (isPrimary) return `primary-${item.id}`;
  const aliases: Record<string, string> = {
    memberships: 'memberships',
    amendments: 'amendments',
    events: 'events',
    'blogs-and-statements': 'publications',
    operation: 'operation',
    network: 'network',
    text: 'amendment-text',
    changeRequests: 'change-requests',
    process: 'process',
  };
  return `secondary-${aliases[item.id] ?? item.id}`;
}

export function NavItemListView({
  navigationItems,
  isMobile,
  isPrimary,
  navigationView,
  screenType,
  currentRoute,
  loadingItem,
  handleItemClick,
}: NavItemListViewProps) {
  const { t } = useTranslation();
  const commandBoxHint = t('navigation.commandDialog.shortcut.hint');
  const isCommandBoxSearchItem = (item: any) => isPrimary && item.id === 'search';
  const getItemShortcut = (item: any) =>
    isCommandBoxSearchItem(item) ? commandDialogShortcut : getShortcutForItem(item.id);
  const getItemTooltipLabel = (item: any) =>
    isCommandBoxSearchItem(item) ? commandBoxHint : item.label;
  const shouldShowNavigationTooltip = (item: any, iconOnly = false) =>
    !isMobile && (iconOnly || isCommandBoxSearchItem(item) || Boolean(getItemShortcut(item)));

  if (navigationView === 'asButton') {
    return (
      <div className="scrollbar-hide max-h-[70vh] overflow-y-auto">
        <div className={featureThemeClassName('navigationNavItemListLayout')}>
          {/* Use different layout for fewer items */}
          {navigationItems.length <= 4 ? (
            <div className="col-span-full flex flex-wrap justify-center gap-8">
              {navigationItems.map((item: any) => (
                <NavigationItemTooltip
                  key={item.id}
                  enabled={shouldShowNavigationTooltip(item)}
                  label={getItemTooltipLabel(item)}
                  shortcut={getItemShortcut(item)}
                  side="top"
                >
                  <Link
                    to={item.href || '#'}
                    preload="intent"
                    className="inline-block"
                    data-tutorial-anchor={tutorialAnchor(item, isPrimary)}
                  >
                    <Button
                      aria-label={item.label}
                      variant="ghost"
                      disabled={loadingItem === item.id}
                      className={cn(
                        'hover:bg-accent relative h-24 w-24 flex-shrink-0 flex-col gap-2',
                        isItemActive(item, currentRoute, isPrimary) &&
                          'bg-accent text-accent-foreground'
                      )}
                      onClick={e => {
                        if (item.onClick) {
                          e.preventDefault();
                          handleItemClick(item);
                        }
                      }}
                    >
                      {loadingItem === item.id ? (
                        <Loader2 className="h-8 w-8 animate-spin" />
                      ) : (
                        <NavigationItemIcon
                          item={item}
                          className={cn(
                            'h-8 w-8',
                            isItemActive(item, currentRoute, isPrimary) && 'text-primary'
                          )}
                        />
                      )}
                      <span className="text-sm">{item.label}</span>
                    </Button>
                  </Link>
                </NavigationItemTooltip>
              ))}
            </div>
          ) : (
            // Original layout for 5+ items
            navigationItems.map((item: any) => (
              <NavigationItemTooltip
                key={item.id}
                enabled={shouldShowNavigationTooltip(item)}
                label={getItemTooltipLabel(item)}
                shortcut={getItemShortcut(item)}
                side="top"
              >
                <Link
                  to={item.href || '#'}
                  preload="intent"
                  className="inline-block"
                  data-tutorial-anchor={tutorialAnchor(item, isPrimary)}
                >
                  <Button
                    aria-label={item.label}
                    variant="ghost"
                    disabled={loadingItem === item.id}
                    className={cn(
                      'hover:bg-accent relative h-24 w-24 flex-shrink-0 flex-col gap-2',
                      isItemActive(item, currentRoute, isPrimary) &&
                        'bg-accent text-accent-foreground'
                    )}
                    onClick={e => {
                      if (item.onClick) {
                        e.preventDefault();
                        handleItemClick(item);
                      }
                    }}
                  >
                    {loadingItem === item.id ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <NavigationItemIcon
                        item={item}
                        className={cn(
                          'h-8 w-8',
                          isItemActive(item, currentRoute, isPrimary) && 'text-primary'
                        )}
                      />
                    )}
                    <span className="text-sm">{item.label}</span>
                  </Button>
                </Link>
              </NavigationItemTooltip>
            ))
          )}
        </div>
      </div>
    );
  }

  if (navigationView === 'asButtonList') {
    const scrollerClasses =
      screenType === 'mobile'
        ? 'scrollbar-hide overflow-x-auto'
        : screenType === 'desktop'
          ? 'overflow-visible'
          : 'scrollbar-hide overflow-x-auto md:overflow-visible';
    const listClasses =
      screenType === 'mobile'
        ? 'flex min-w-max items-center justify-center gap-1 px-2'
        : screenType === 'desktop'
          ? 'flex flex-col items-center gap-2'
          : 'flex min-w-max items-center justify-center gap-1 px-2 md:min-w-0 md:flex-col md:gap-2 md:px-0';

    return (
      <div
        className={scrollerClasses}
        data-tutorial-horizontal-scroller={
          isPrimary && screenType !== 'desktop' ? 'primary-navigation' : undefined
        }
      >
        <div className={listClasses}>
          {navigationItems.map((item: any) => (
            <NavigationItemTooltip
              key={item.id}
              enabled={shouldShowNavigationTooltip(item, true)}
              label={getItemTooltipLabel(item)}
              shortcut={getItemShortcut(item)}
              side="right"
            >
              <Link
                to={item.href || '#'}
                preload="intent"
                aria-label={item.label}
                data-slot="button"
                data-tutorial-anchor={tutorialAnchor(item, isPrimary)}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                  getMotionPreset('colors'),
                  getMotionPreset('press'),
                  getMotionPreset('iconNudge'),
                  'relative h-12 w-12 flex-shrink-0',
                  isItemActive(item, currentRoute, isPrimary) && 'bg-accent text-accent-foreground'
                )}
                onClick={e => {
                  if (item.onClick) {
                    e.preventDefault();
                    item.onClick();
                  }
                }}
              >
                <NavigationItemIcon
                  item={item}
                  className={cn(
                    'h-5 w-5',
                    isItemActive(item, currentRoute, isPrimary) && 'text-primary'
                  )}
                />
              </Link>
            </NavigationItemTooltip>
          ))}
        </div>
      </div>
    );
  }

  if (navigationView === 'asLabeledButtonList') {
    const scrollerClasses =
      screenType === 'mobile'
        ? 'scrollbar-hide overflow-x-auto'
        : screenType === 'desktop'
          ? 'overflow-visible'
          : 'scrollbar-hide overflow-x-auto md:overflow-visible';
    const listClasses =
      screenType === 'mobile'
        ? 'flex min-w-max items-center justify-center gap-1 px-2'
        : screenType === 'desktop'
          ? 'flex flex-col gap-2'
          : 'flex min-w-max items-center justify-center gap-1 px-2 md:min-w-0 md:flex-col md:gap-2 md:px-0';
    const linkClasses =
      screenType === 'mobile'
        ? 'inline-block'
        : screenType === 'desktop'
          ? 'inline-block w-full'
          : 'inline-block md:w-full';
    const buttonClasses =
      screenType === 'mobile'
        ? 'hover:bg-accent flex h-16 min-w-16 flex-shrink-0 flex-col gap-1 px-2'
        : screenType === 'desktop'
          ? 'h-12 w-full flex-shrink-0 justify-start gap-3 px-3'
          : 'hover:bg-accent flex h-16 min-w-16 flex-shrink-0 flex-col gap-1 px-2 md:h-12 md:w-full md:flex-row md:justify-start md:gap-3 md:px-3';
    const labelClasses =
      screenType === 'mobile'
        ? 'text-center text-xs leading-tight whitespace-nowrap'
        : screenType === 'desktop'
          ? 'truncate text-sm'
          : 'text-center text-xs leading-tight whitespace-nowrap md:truncate md:text-left md:text-sm';

    return (
      <div
        className={scrollerClasses}
        data-tutorial-horizontal-scroller={
          isPrimary && screenType !== 'desktop' ? 'primary-navigation' : undefined
        }
      >
        <div className={listClasses}>
          {navigationItems.map((item: any) => (
            <NavigationItemTooltip
              key={item.id}
              enabled={shouldShowNavigationTooltip(item)}
              label={getItemTooltipLabel(item)}
              shortcut={getItemShortcut(item)}
              side="right"
            >
              <Link
                to={item.href || '#'}
                preload="intent"
                className={linkClasses}
                data-tutorial-anchor={tutorialAnchor(item, isPrimary)}
              >
                <Button
                  aria-label={item.label}
                  variant="ghost"
                  className={cn(
                    buttonClasses,
                    isItemActive(item, currentRoute, isPrimary) &&
                      'bg-accent text-accent-foreground'
                  )}
                  onClick={e => {
                    if (item.onClick) {
                      e.preventDefault();
                      item.onClick();
                    }
                  }}
                >
                  <NavigationItemIcon
                    item={item}
                    className={cn(
                      'h-5 w-5 flex-shrink-0',
                      isItemActive(item, currentRoute, isPrimary) && 'text-primary'
                    )}
                  />
                  <span className={labelClasses}>{item.label}</span>
                </Button>
              </Link>
            </NavigationItemTooltip>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

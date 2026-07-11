import { featureThemeClassName, getMotionPreset } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button, buttonVariants } from '@/features/shared/ui/ui/button.tsx';
import { cn } from '@/features/shared/utils/utils.ts';
import { iconMap } from '@/features/navigation/nav-items/icon-map.tsx';
import React from 'react';
import { Link } from '@tanstack/react-router';
import { isItemActive } from './nav-helpers.ts';
import { Loader2 } from 'lucide-react';
export interface NavItemListViewProps {
  navigationItems: any;
  isMobile: any;
  isPrimary: any;
  navigationView: any;
  pathname: any;
  hash: any;
  isRouterPending: any;
  normalizedHash: any;
  currentRoute: any;
  loadingItem: any;
  setLoadingItem: any;
  handleItemClick: any;
}

export function NavItemListView({
  navigationItems,
  isMobile,
  isPrimary,
  navigationView,
  currentRoute,
  loadingItem,
  handleItemClick,
}: NavItemListViewProps) {
  if (navigationView === 'asButton') {
    return (
      <div className="scrollbar-hide max-h-[70vh] overflow-y-auto">
        <div className={featureThemeClassName('navigationNavItemListLayout')}>
          {/* Use different layout for fewer items */}
          {navigationItems.length <= 4 ? (
            <div className="col-span-full flex flex-wrap justify-center gap-8">
              {navigationItems.map((item: any) => (
                <Link key={item.id} to={item.href || '#'} preload="intent" className="inline-block">
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
                      React.createElement(iconMap[item.icon as keyof typeof iconMap], {
                        className: cn(
                          'h-8 w-8',
                          isItemActive(item, currentRoute, isPrimary) && 'text-primary'
                        ),
                      })
                    )}
                    <span className="text-sm">{item.label}</span>
                    {item.badge && (
                      <BadgeControl
                        className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center p-0"
                        variant="default"
                      >
                        {(() => {
                          return item.badge;
                        })()}
                      </BadgeControl>
                    )}
                  </Button>
                </Link>
              ))}
            </div>
          ) : (
            // Original layout for 5+ items
            navigationItems.map((item: any) => (
              <Link key={item.id} to={item.href || '#'} preload="intent" className="inline-block">
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
                    React.createElement(iconMap[item.icon as keyof typeof iconMap], {
                      className: cn(
                        'h-8 w-8',
                        isItemActive(item, currentRoute, isPrimary) && 'text-primary'
                      ),
                    })
                  )}
                  <span className="text-sm">{item.label}</span>
                  {item.badge && (
                    <BadgeControl
                      className="absolute top-2 right-4 flex h-5 w-5 items-center justify-center p-0"
                      variant="default"
                    >
                      {item.badge}
                    </BadgeControl>
                  )}
                </Button>
              </Link>
            ))
          )}
        </div>
      </div>
    );
  }

  // asButtonList variant - Mobile: Horizontal scrolling links with native labels
  if (navigationView === 'asButtonList' && isMobile) {
    return (
      <div className="scrollbar-hide flex-1 overflow-x-auto">
        <div className="flex min-w-max items-center justify-center gap-1 px-2">
          {navigationItems.map((item: any) => (
            <Link
              key={item.id}
              to={item.href || '#'}
              preload="intent"
              aria-label={item.label}
              title={item.label}
              data-slot="button"
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
              {React.createElement(iconMap[item.icon as keyof typeof iconMap], {
                className: cn(
                  'h-5 w-5',
                  isItemActive(item, currentRoute, isPrimary) && 'text-primary'
                ),
              })}
              {item.badge && (
                <BadgeControl
                  className="absolute top-2 right-4 flex h-5 w-5 items-center justify-center p-0"
                  variant="default"
                >
                  {item.badge}
                </BadgeControl>
              )}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // asButtonList variant - Desktop: Vertical sidebar with icon links and native labels
  if (navigationView === 'asButtonList' && !isMobile) {
    return (
      <div className={cn('flex flex-col items-center gap-2')}>
        {navigationItems.map((item: any) => (
          <Link
            key={item.id}
            to={item.href || '#'}
            preload="intent"
            aria-label={item.label}
            title={item.label}
            data-slot="button"
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
            {React.createElement(iconMap[item.icon as keyof typeof iconMap], {
              className: cn(
                'h-5 w-5',
                isItemActive(item, currentRoute, isPrimary) && 'text-primary'
              ),
            })}
            {item.badge && (
              <BadgeControl
                className="absolute -top-0 -right-1 flex h-5 w-5 items-center justify-center p-0"
                variant="default"
              >
                {item.badge}
              </BadgeControl>
            )}
          </Link>
        ))}
      </div>
    );
  }

  // asLabeledButtonList variant - Mobile: Horizontal scrolling buttons with labels
  if (navigationView === 'asLabeledButtonList' && isMobile) {
    return (
      <div className="scrollbar-hide flex-1 overflow-x-auto">
        <div className="flex min-w-max items-center justify-center gap-1 px-2">
          {navigationItems.map((item: any) => (
            <Link key={item.id} to={item.href || '#'} preload="intent" className="inline-block">
              <Button
                aria-label={item.label}
                variant="ghost"
                className={cn(
                  'hover:bg-accent flex h-16 min-w-16 flex-shrink-0 flex-col gap-1 px-2',
                  isItemActive(item, currentRoute, isPrimary) && 'bg-accent text-accent-foreground'
                )}
                onClick={e => {
                  if (item.onClick) {
                    e.preventDefault();
                    item.onClick();
                  }
                }}
              >
                <div className="relative">
                  {' '}
                  {React.createElement(iconMap[item.icon as keyof typeof iconMap], {
                    className: cn(
                      'h-5 w-5 flex-shrink-0',
                      isItemActive(item, currentRoute, isPrimary) && 'text-primary'
                    ),
                  })}
                  {item.badge && (
                    <BadgeControl
                      className="absolute -top-3 -right-5 flex h-5 w-5 items-center justify-center p-0"
                      variant="default"
                    >
                      {item.badge}
                    </BadgeControl>
                  )}
                </div>
                <span className="text-center text-xs leading-tight whitespace-nowrap">
                  {item.label}
                </span>
              </Button>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // asLabeledButtonList variant - Desktop: Full sidebar with icons and labels
  if (navigationView === 'asLabeledButtonList' && !isMobile) {
    return (
      <div className="flex flex-col gap-2">
        {navigationItems.map((item: any) => (
          <Link key={item.id} to={item.href || '#'} preload="intent" className="inline-block">
            <Button
              aria-label={item.label}
              variant="ghost"
              className={cn(
                'h-12 w-full flex-shrink-0 justify-start gap-3 px-3',
                isItemActive(item, currentRoute, isPrimary) && 'bg-accent text-accent-foreground'
              )}
              onClick={e => {
                if (item.onClick) {
                  e.preventDefault();
                  item.onClick();
                }
              }}
            >
              {React.createElement(iconMap[item.icon as keyof typeof iconMap], {
                className: cn(
                  'h-5 w-5',
                  isItemActive(item, currentRoute, isPrimary) && 'text-primary'
                ),
              })}
              <span>{item.label}</span>
              {item.badge && (
                <BadgeControl className="ml-auto" variant="default">
                  {item.badge}
                </BadgeControl>
              )}
            </Button>
          </Link>
        ))}
      </div>
    );
  }

  return null;
}

'use client';

import { getContentTypeToneClasses, getMotionPreset } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { ReactNode } from 'react';
import { cn } from '@/features/shared/utils/utils';
import { Button } from '@/features/shared/ui/ui/button';
import { LinkSurface } from '@/features/shared/ui/navigation/LinkSurface.tsx';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { CARD_RADIUS, getCardShadowClasses } from '../../logic/gradient-assignment';
import {
  ContentType,
  CONTENT_TYPE_CONFIG,
  getContentTypeGradient,
} from '../../constants/content-type-config';
import { type LucideIcon } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

export interface TimelineCardBaseProps {
  'data-action-id'?: string;
  contentType: ContentType;
  className?: string;
  children: ReactNode;
  elevated?: boolean;
  onClick?: () => void;
  /** URL to navigate to when card is clicked (supports browser-native new-tab gestures) */
  href?: string;
}

/**
 * Base card wrapper for all timeline cards
 * Provides consistent styling, shadows, and hover effects
 * When href is provided, the card becomes a real anchor surface while preserving
 * interactive descendants such as buttons and nested links.
 */
export function TimelineCardBase({
  'data-action-id': actionId,
  contentType,
  className,
  children,
  elevated = false,
  onClick,
  href,
}: TimelineCardBaseProps) {
  const { t } = useTranslation();
  const shadowClasses = getCardShadowClasses(elevated);
  const tone = getContentTypeToneClasses(contentType);

  const cardStyles = cn(
    tone.border,
    'bg-card text-card-foreground flex min-h-0 flex-col overflow-hidden border',
    CARD_RADIUS.card,
    shadowClasses,
    getMotionPreset('hoverLift'),
    (onClick || href) && getMotionPreset('spotlight'),
    (onClick || href) && 'cursor-pointer',
    className
  );

  if (href) {
    return (
      <LinkSurface
        data-action-id={actionId}
        data-action-scope="presentation"
        href={href}
        mode="overlay"
        label={t('common.accessibility.openNamed', {
          name: t(CONTENT_TYPE_CONFIG[contentType].labelKey),
        })}
        containerClassName={cardStyles}
        contentClassName="flex min-h-0 flex-1 flex-col"
      >
        {children}
      </LinkSurface>
    );
  }

  return (
    <div
      data-action-id={actionId}
      data-action-scope="presentation"
      className={cardStyles}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={e => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </div>
  );
}

export interface TimelineCardHeaderProps {
  contentType: ContentType;
  title: string;
  /** URL for the card's primary link (makes title right-clickable) */
  href?: string;
  subtitle?: string;
  /** URL for the subtitle link (e.g., group page) */
  subtitleHref?: string;
  badge?: ReactNode;
  showIcon?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Header component for timeline cards with gradient background
 */
export function TimelineCardHeader({
  contentType,
  title,
  href,
  subtitle,
  subtitleHref,
  badge,
  showIcon = true,
  className,
  children,
}: TimelineCardHeaderProps) {
  const config = CONTENT_TYPE_CONFIG[contentType];
  const gradient = getContentTypeGradient(contentType);
  const Icon = config.icon;

  return (
    <div className={cn('shrink-0 p-4', gradient, className)} data-timeline-card-header>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {showIcon && <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', config.accentColor)} />}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base leading-tight font-semibold">
              {href ? (
                <SmartLink
                  data-action-id="timeline.card.header.title.open"
                  data-action-kind="navigation"
                  href={href}
                  onClick={e => e.stopPropagation()}
                  className="hover:underline"
                >
                  {title}
                </SmartLink>
              ) : (
                title
              )}
            </h3>
            {subtitle &&
              (subtitleHref ? (
                <SmartLink
                  data-action-id="timeline.card.header.subtitle.open"
                  data-action-kind="navigation"
                  href={subtitleHref}
                  onClick={e => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground mt-0.5 block truncate text-xs hover:underline"
                >
                  {subtitle}
                </SmartLink>
              ) : (
                <p className="text-muted-foreground mt-0.5 truncate text-xs">{subtitle}</p>
              ))}
          </div>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

export interface TimelineCardContentProps {
  className?: string;
  children: ReactNode;
}

/**
 * Content area for timeline cards
 */
export function TimelineCardContent({ className, children }: TimelineCardContentProps) {
  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col p-4 pt-3', className)}
      data-timeline-card-content
    >
      {children}
    </div>
  );
}

export interface TimelineCardActionsProps {
  className?: string;
  children: ReactNode;
}

/**
 * Action bar for timeline cards
 */
export function TimelineCardActions({ className, children }: TimelineCardActionsProps) {
  return (
    <div
      className={cn(
        'border-border/70 bg-muted/30 mt-auto flex shrink-0 flex-wrap items-center gap-2 border-t px-4 py-3',
        className
      )}
      data-timeline-card-actions
    >
      {children}
    </div>
  );
}

export interface TimelineCardActionButtonProps {
  'data-action-id'?: string;
  icon?: LucideIcon;
  label: string;
  onClick?: (e?: React.MouseEvent) => void;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'sm' | 'default';
  className?: string;
  disabled?: boolean;
}

/**
 * Standard action button for timeline cards
 */
export function TimelineCardActionButton({
  'data-action-id': actionId,
  icon: Icon,
  label,
  onClick,
  variant = 'outline',
  size = 'sm',
  className,
  disabled,
}: TimelineCardActionButtonProps) {
  return (
    <Button
      data-action-id={actionId}
      data-action-scope="presentation"
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn('flex items-center gap-1.5', className)}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span className="text-xs">{label}</span>
    </Button>
  );
}

export interface TimelineCardStatsProps {
  stats: {
    icon?: LucideIcon;
    label: string;
    value: string | number;
  }[];
  className?: string;
}

/**
 * Stats row for timeline cards
 */
export function TimelineCardStats({ stats, className }: TimelineCardStatsProps) {
  return (
    <div className={cn('text-muted-foreground flex items-center gap-4 text-xs', className)}>
      {stats.map((stat, index) => (
        <div key={index} className="flex items-center gap-1">
          {stat.icon && <stat.icon className="h-3.5 w-3.5" />}
          <span className="font-medium">{stat.value}</span>
          <span>{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

export interface TimelineCardBadgeProps {
  label: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  icon?: LucideIcon;
  className?: string;
}

/**
 * Status/type badge for timeline cards
 */
export function TimelineCardBadge({
  label,
  variant = 'outline',
  icon: Icon,
  className,
}: TimelineCardBadgeProps) {
  return (
    <BadgeControl variant={variant} className={cn('flex-shrink-0 text-xs', className)}>
      {Icon && <Icon className="mr-1 h-3 w-3" />}
      {label}
    </BadgeControl>
  );
}

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@/features/shared/utils/utils.ts';
import { getMotionPreset } from '@/features/shared/theme';
import { SurfaceLayerProvider } from '@/features/shared/ui/layout/SurfaceDepthContext';

type CardProps = React.ComponentPropsWithoutRef<'div'> & {
  asChild?: boolean;
  surface?:
    | 'default'
    | 'muted'
    | 'mutedSubtle'
    | 'background'
    | 'backgroundSoft'
    | 'primarySoft'
    | 'primaryStrong'
    | 'infoSoft'
    | 'successSoft'
    | 'blueSoft'
    | 'graySoft'
    | 'purpleSoft'
    | 'emeraldSelected'
    | 'warmGradient'
    | 'indigoGradient'
    | 'subtleGradient'
    | 'skyPanel'
    | 'search';
  borderStyle?: 'default' | 'none' | 'dashed' | 'muted';
  elevation?: 'default' | 'none' | 'lg' | 'ringPrimary' | 'ringSuccess';
  shape?: 'default' | 'xl';
  interactive?: 'default' | 'shadow' | 'lift' | 'accent' | 'spotlight' | 'selectable';
};

const cardSurfaceClasses: Record<NonNullable<CardProps['surface']>, string> = {
  default: '',
  muted: 'bg-[var(--surface-muted)]',
  mutedSubtle: 'bg-[var(--surface)]',
  background: 'bg-background',
  backgroundSoft: 'bg-[var(--surface-overlay)]',
  primarySoft: 'border-primary/20 bg-primary/5',
  primaryStrong: 'border-primary/50 border-2 bg-primary/5',
  infoSoft:
    'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
  successSoft:
    'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  blueSoft:
    'border-[var(--entity-user-border)] bg-[var(--entity-user-bg)] text-[var(--entity-user-fg)]',
  graySoft:
    'border-[var(--badge-neutral-border)] bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]',
  purpleSoft:
    'border-[var(--entity-amendment-border)] bg-[var(--entity-amendment-bg)] text-[var(--entity-amendment-fg)]',
  emeraldSelected:
    'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] ring-2 ring-[var(--badge-success-border)] ring-offset-2',
  warmGradient:
    'border-2 border-[var(--entity-event-border)] bg-[image:var(--entity-event-gradient)]',
  indigoGradient:
    'border-2 border-[var(--entity-amendment-border)] bg-[image:var(--entity-amendment-gradient)]',
  subtleGradient: 'border-border/70 from-background to-[var(--surface)] bg-gradient-to-b',
  skyPanel: 'bg-background/80 border-[var(--badge-info-border)]',
  search: 'rounded-lg border-border shadow-[var(--shadow-panel)]',
};

const cardBorderClasses: Record<NonNullable<CardProps['borderStyle']>, string> = {
  default: '',
  none: 'border-0',
  dashed: 'border-dashed',
  muted: 'border-muted',
};

const cardElevationClasses: Record<NonNullable<CardProps['elevation']>, string> = {
  default: '',
  none: 'shadow-none',
  lg: 'shadow-[var(--shadow-card)]',
  ringPrimary: 'border-primary ring-primary/20 border-2 shadow-[var(--shadow-card)] ring-2',
  ringSuccess: 'ring-2 ring-[var(--badge-success-border)] ring-offset-2',
};

const cardInteractiveClasses: Record<NonNullable<CardProps['interactive']>, string> = {
  default: '',
  shadow:
    'transition-shadow duration-[var(--motion-duration-base)] hover:shadow-[var(--shadow-card)]',
  lift: 'civic-motion-hover-lift hover:border-primary/40',
  accent: 'hover:bg-accent',
  spotlight: 'civic-motion-spotlight civic-motion-hover-lift',
  selectable: 'civic-motion-selectable cursor-pointer',
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      asChild = false,
      className,
      surface = 'default',
      borderStyle = 'default',
      elevation = 'default',
      shape = 'default',
      interactive = 'default',
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'div';

    return (
      <SurfaceLayerProvider>
        <Comp
          ref={ref}
          className={cn(
            'bg-card text-card-foreground rounded-lg border shadow-[var(--shadow-panel)]',
            getMotionPreset('colors'),
            cardSurfaceClasses[surface],
            cardBorderClasses[borderStyle],
            cardElevationClasses[elevation],
            shape === 'xl' && 'rounded-xl',
            cardInteractiveClasses[interactive],
            className
          )}
          {...props}
        />
      </SurfaceLayerProvider>
    );
  }
);
Card.displayName = 'Card';

interface CardSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'default' | 'center';
  separator?: boolean;
  surface?: 'default' | 'primarySoft';
  tone?: 'default' | 'muted';
}

const CardHeader = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, align = 'default', separator = false, surface = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col space-y-1.5 p-6',
        align === 'center' && 'text-center',
        separator && 'border-b',
        surface === 'primarySoft' && 'bg-primary/5',
        className
      )}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  size?: 'default' | 'sm' | 'base' | 'lg' | 'xl';
  tone?: 'default' | 'muted' | 'primary';
  weight?: 'default' | 'medium';
}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, size = 'default', tone = 'default', weight = 'default', ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'text-2xl leading-none font-semibold tracking-tight',
        size === 'sm' && 'text-sm',
        size === 'base' && 'text-base',
        size === 'lg' && 'text-lg',
        size === 'xl' && 'text-xl',
        tone === 'muted' && 'text-muted-foreground',
        tone === 'primary' && 'text-primary',
        weight === 'medium' && 'font-medium',
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

interface CardDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {
  leading?: 'default' | 'relaxed';
  tone?: 'default' | 'primary';
}

const CardDescription = React.forwardRef<HTMLDivElement, CardDescriptionProps>(
  ({ className, leading = 'default', tone = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'text-muted-foreground text-sm',
        leading === 'relaxed' && 'leading-6',
        tone === 'primary' && 'text-primary',
        className
      )}
      {...props}
    />
  )
);
CardDescription.displayName = 'CardDescription';

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'default' | 'center';
  tone?: 'default' | 'muted';
  prose?: boolean;
  separator?: boolean;
}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  (
    { className, align = 'default', tone = 'default', prose = false, separator = false, ...props },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        'p-6 pt-0',
        align === 'center' && 'text-center',
        tone === 'muted' && 'text-muted-foreground',
        prose && 'prose prose-slate dark:prose-invert',
        separator && 'border-t',
        className
      )}
      {...props}
    />
  )
);
CardContent.displayName = 'CardContent';

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'muted';
}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, tone = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center p-6 pt-0',
        tone === 'muted' && 'text-muted-foreground',
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@/features/shared/utils/utils.ts';

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
  interactive?: 'default' | 'shadow' | 'lift' | 'accent';
};

const cardSurfaceClasses: Record<NonNullable<CardProps['surface']>, string> = {
  default: '',
  muted: 'bg-muted/50',
  mutedSubtle: 'bg-muted/20',
  background: 'bg-background',
  backgroundSoft: 'bg-background/90',
  primarySoft: 'border-primary/20 bg-primary/5',
  primaryStrong: 'border-primary/50 border-2 bg-primary/5',
  infoSoft: 'border-blue-500/50 bg-blue-500/5',
  successSoft: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/50',
  blueSoft: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50',
  graySoft: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50',
  purpleSoft: 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/50',
  emeraldSelected:
    'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20 ring-offset-2 dark:border-emerald-400 dark:bg-emerald-950/20 dark:ring-emerald-400/25 dark:ring-offset-gray-900',
  warmGradient:
    'border-2 bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900/40 dark:to-orange-900/50',
  indigoGradient:
    'border-2 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/50',
  subtleGradient: 'border-border/70 from-background to-muted/20 bg-gradient-to-b',
  skyPanel: 'bg-background/80 border-sky-500/20',
  search: 'rounded-xl border-gray-100 shadow-sm dark:border-gray-800',
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
  lg: 'shadow-lg',
  ringPrimary: 'border-primary ring-primary/20 border-2 shadow-lg ring-2',
  ringSuccess: 'ring-2 ring-emerald-500/20 ring-offset-2',
};

const cardInteractiveClasses: Record<NonNullable<CardProps['interactive']>, string> = {
  default: '',
  shadow: 'transition-shadow hover:shadow-lg',
  lift: 'transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg',
  accent: 'hover:bg-accent',
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
      <Comp
        ref={ref}
        className={cn(
          'bg-card text-card-foreground rounded-lg border shadow-sm',
          cardSurfaceClasses[surface],
          cardBorderClasses[borderStyle],
          cardElevationClasses[elevation],
          shape === 'xl' && 'rounded-xl',
          cardInteractiveClasses[interactive],
          className
        )}
        {...props}
      />
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

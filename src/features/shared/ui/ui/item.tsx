import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/features/shared/utils/utils.ts';

const itemVariants = cva('flex w-full min-w-0 items-center gap-3 rounded-md text-sm', {
  variants: {
    variant: {
      default: '',
      outline: 'border bg-background shadow-xs',
      muted: 'bg-muted/50',
    },
    size: {
      default: 'p-4',
      sm: 'p-3',
      xs: 'p-2',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

type ItemProps = React.ComponentProps<'div'> &
  VariantProps<typeof itemVariants> & {
    asChild?: boolean;
  };

function Item({ className, variant, size, asChild = false, ...props }: ItemProps) {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp data-slot="item" className={cn(itemVariants({ variant, size, className }))} {...props} />
  );
}

function ItemGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="item-group" className={cn('grid gap-2', className)} {...props} />;
}

function ItemHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-header"
      className={cn('flex min-w-0 items-center gap-3', className)}
      {...props}
    />
  );
}

function ItemMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & { variant?: 'default' | 'icon' | 'avatar' | 'image' }) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(
        'flex shrink-0 items-center justify-center',
        variant === 'icon' && 'bg-muted text-muted-foreground size-8 rounded-md',
        variant === 'avatar' && 'size-10 overflow-hidden rounded-full',
        variant === 'image' && 'size-12 overflow-hidden rounded-md',
        className
      )}
      {...props}
    />
  );
}

function ItemContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-content"
      className={cn('min-w-0 flex-1 space-y-1', className)}
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-title"
      className={cn('truncate text-sm leading-none font-medium', className)}
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="item-description"
      className={cn('text-muted-foreground line-clamp-2 text-sm', className)}
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-actions"
      className={cn('flex shrink-0 items-center gap-2', className)}
      {...props}
    />
  );
}

function ItemFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-footer"
      className={cn('text-muted-foreground flex items-center gap-2 text-xs', className)}
      {...props}
    />
  );
}

export {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemTitle,
  itemVariants,
};
export type { ItemProps };

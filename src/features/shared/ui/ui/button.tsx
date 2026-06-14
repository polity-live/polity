import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/features/shared/utils/utils.ts';
import { getMotionPreset } from '@/features/shared/theme';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline:
          'border border-border bg-card shadow-sm hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    presentation?:
      | 'default'
      | 'transparentGhost'
      | 'success'
      | 'monoCompact'
      | 'mutedTiny'
      | 'floatingShadow';
  };

const buttonPresentationClasses: Record<NonNullable<ButtonProps['presentation']>, string> = {
  default: '',
  transparentGhost: 'h-auto p-0 hover:bg-transparent',
  success: 'bg-success text-success-foreground hover:bg-success/90',
  monoCompact: 'font-mono text-xs',
  mutedTiny: 'text-muted-foreground text-xs',
  floatingShadow: 'shadow-[var(--shadow-floating)]',
};

function Button({
  className,
  variant,
  size,
  asChild = false,
  presentation = 'default',
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size }),
        getMotionPreset('colors'),
        variant !== 'link' && getMotionPreset('press'),
        buttonPresentationClasses[presentation],
        className
      )}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };

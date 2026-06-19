import * as React from 'react';

import { Button, type ButtonProps } from '@/features/shared/ui/ui/button';
import { ToggleGroupItem } from '@/features/shared/ui/ui/toggle-group';
import { cn } from '@/features/shared/utils/utils';

export function getFilterButtonClassName(active: boolean, className?: string) {
  return cn(
    'border transition-[color,background-color,border-color,box-shadow]',
    active
      ? 'border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground'
      : 'border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground',
    className
  );
}

export interface FilterButtonProps extends Omit<ButtonProps, 'variant'> {
  active: boolean;
}

export function FilterButton({
  active,
  className,
  size = 'sm',
  type = 'button',
  'aria-pressed': ariaPressed,
  ...props
}: FilterButtonProps) {
  return (
    <Button
      data-slot="filter-button"
      data-active={active ? 'true' : 'false'}
      type={type}
      variant={active ? 'default' : 'outline'}
      size={size}
      aria-pressed={ariaPressed ?? active}
      className={getFilterButtonClassName(active, className)}
      {...props}
    />
  );
}

export function getFilterToggleGroupItemClassName(className?: string) {
  return cn(
    'data-[state=on]:border-transparent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary/90 data-[state=off]:bg-card data-[state=off]:text-foreground data-[state=off]:hover:bg-accent data-[state=off]:hover:text-accent-foreground',
    className
  );
}

export const FilterToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupItem>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupItem>
>(({ className, ...props }, ref) => (
  <ToggleGroupItem
    ref={ref}
    data-slot="filter-toggle-group-item"
    className={getFilterToggleGroupItemClassName(className)}
    {...props}
  />
));
FilterToggleGroupItem.displayName = 'FilterToggleGroupItem';

import * as React from 'react';

import * as ToolbarPrimitive from '@radix-ui/react-toolbar';
import { type VariantProps, cva } from 'class-variance-authority';
import { Check, ChevronDown, Loader2 } from 'lucide-react';

import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import { Separator } from '@/features/shared/ui/ui/separator.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type TooltipContentProps,
} from '@/features/shared/ui/ui/tooltip.tsx';
import type { KeyboardShortcutDefinition } from '@/features/shared/keyboard/keyboard-shortcut';
import { cn } from '@/features/shared/utils/utils.ts';

export function Toolbar({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Root>) {
  return (
    <ToolbarPrimitive.Root
      className={cn(
        'border-border text-foreground relative flex items-center rounded-md border bg-[var(--surface-overlay)] shadow-[var(--shadow-panel)] backdrop-blur-md select-none',
        className
      )}
      {...props}
    />
  );
}

export function ToolbarToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.ToolbarToggleGroup>) {
  return (
    <ToolbarPrimitive.ToolbarToggleGroup
      className={cn('flex items-center', className)}
      {...props}
    />
  );
}

export function ToolbarLink({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Link>) {
  return (
    <ToolbarPrimitive.Link
      className={cn('font-medium underline underline-offset-4', className)}
      {...props}
    />
  );
}

export function ToolbarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Separator>) {
  return (
    <ToolbarPrimitive.Separator
      className={cn('bg-border mx-2 my-1 w-px shrink-0', className)}
      {...props}
    />
  );
}

// From toggleVariants
const toolbarButtonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow,transform] duration-[var(--motion-duration-fast)] outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-success aria-pressed:text-success-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-9 min-w-9 px-2',
        lg: 'h-10 min-w-10 px-2.5',
        sm: 'h-8 min-w-8 px-1.5',
      },
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-input bg-card shadow-sm hover:bg-accent hover:text-accent-foreground',
      },
    },
  }
);

const dropdownArrowVariants = cva(
  cn(
    'inline-flex items-center justify-center rounded-r-md text-sm font-medium text-foreground transition-colors disabled:pointer-events-none disabled:opacity-50'
  ),
  {
    defaultVariants: {
      size: 'sm',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-9 w-6',
        lg: 'h-10 w-8',
        sm: 'h-8 w-4',
      },
      variant: {
        default:
          'bg-transparent hover:bg-muted hover:text-muted-foreground aria-pressed:bg-success aria-pressed:text-success-foreground',
        outline:
          'border border-l-0 border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
      },
    },
  }
);

type ToolbarButtonProps = {
  isDropdown?: boolean;
  asChild?: boolean;
  pressed?: boolean;
  loading?: boolean;
  loadingLabel?: React.ReactNode;
  successState?: boolean;
  successLabel?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<typeof ToolbarToggleItem>, 'asChild' | 'value'> &
  VariantProps<typeof toolbarButtonVariants>;

function renderToolbarButtonContent({
  children,
  loading,
  loadingLabel,
  successState,
  successLabel,
}: Pick<
  ToolbarButtonProps,
  'children' | 'loading' | 'loadingLabel' | 'successState' | 'successLabel'
>) {
  if (!loading && !successState) {
    return children;
  }

  const label = loading ? loadingLabel : successLabel;

  return (
    <>
      <span className="invisible inline-flex items-center gap-2">{children}</span>
      <span className="pointer-events-none absolute inset-0 inline-flex items-center justify-center gap-2 px-2">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        {label ? <span>{label}</span> : null}
      </span>
    </>
  );
}

export const ToolbarButton = withTooltip(function ToolbarButton({
  children,
  className,
  isDropdown,
  asChild,
  pressed,
  loading = false,
  loadingLabel,
  successState = false,
  successLabel,
  disabled,
  size = 'sm',
  variant,
  ...props
}: ToolbarButtonProps) {
  const showStatus = !asChild && (loading || successState);
  const content = renderToolbarButtonContent({
    children,
    loading: showStatus && loading,
    loadingLabel,
    successState: showStatus && successState,
    successLabel,
  });

  return typeof pressed === 'boolean' ? (
    <ToolbarPrimitive.Button
      className={cn(
        toolbarButtonVariants({
          size,
          variant,
        }),
        showStatus && 'relative',
        isDropdown && 'justify-between gap-1 pr-1',
        className
      )}
      disabled={loading || disabled}
      aria-pressed={pressed}
      aria-busy={loading || undefined}
      data-loading={loading ? 'true' : undefined}
      data-success={successState ? 'true' : undefined}
      {...props}
    >
      {isDropdown ? (
        <>
          <div className="flex flex-1 items-center gap-2 whitespace-nowrap">{content}</div>
          <div>
            <ChevronDown className="text-muted-foreground size-3.5" data-icon />
          </div>
        </>
      ) : (
        content
      )}
    </ToolbarPrimitive.Button>
  ) : (
    <ToolbarPrimitive.Button
      className={cn(
        toolbarButtonVariants({
          size,
          variant,
        }),
        showStatus && 'relative',
        isDropdown && 'pr-1',
        className
      )}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      data-loading={loading ? 'true' : undefined}
      data-success={successState ? 'true' : undefined}
      asChild={asChild}
      {...props}
    >
      {content}
    </ToolbarPrimitive.Button>
  );
});

export function ToolbarSplitButton({
  className,
  pressed,
  ...props
}: React.ComponentPropsWithoutRef<'div'> & { pressed?: boolean }) {
  return (
    <div
      role="group"
      data-pressed={pressed ? 'true' : 'false'}
      className={cn('group flex gap-0 px-0', className)}
      {...props}
    />
  );
}

type ToolbarSplitButtonPrimaryProps = React.ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof toolbarButtonVariants>;

export function ToolbarSplitButtonPrimary({
  children,
  className,
  size = 'sm',
  type = 'button',
  variant,
  ...props
}: ToolbarSplitButtonPrimaryProps) {
  return (
    <button
      type={type}
      className={cn(
        toolbarButtonVariants({
          size,
          variant,
        }),
        'rounded-r-none',
        'group-data-[pressed=true]:bg-success group-data-[pressed=true]:text-success-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ToolbarSplitButtonSecondary({
  className,
  size,
  type = 'button',
  variant,
  ...props
}: React.ComponentPropsWithoutRef<'button'> & VariantProps<typeof dropdownArrowVariants>) {
  return (
    <button
      type={type}
      className={cn(
        dropdownArrowVariants({
          size,
          variant,
        }),
        'group-data-[pressed=true]:bg-success group-data-[pressed=true]:text-success-foreground',
        className
      )}
      onClick={e => e.stopPropagation()}
      {...props}
    >
      <ChevronDown className="text-muted-foreground size-3.5" data-icon />
    </button>
  );
}

export function ToolbarToggleItem({
  className,
  size = 'sm',
  variant,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.ToggleItem> &
  VariantProps<typeof toolbarButtonVariants>) {
  return (
    <ToolbarPrimitive.ToggleItem
      className={cn(toolbarButtonVariants({ size, variant }), className)}
      {...props}
    />
  );
}

export function ToolbarGroup({ children, className }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('group/toolbar-group', 'relative hidden has-[button]:flex', className)}>
      <div className="flex items-center">{children}</div>

      <div className="mx-1.5 py-0.5 group-last/toolbar-group:hidden!">
        <Separator orientation="vertical" />
      </div>
    </div>
  );
}

type TooltipProps<T extends React.ElementType> = {
  tooltip?: React.ReactNode;
  title?: string;
  tooltipShortcut?: KeyboardShortcutDefinition;
  tooltipVariant?: TooltipContentProps['variant'];
  tooltipContentProps?: Omit<TooltipContentProps, 'children' | 'shortcut' | 'variant'>;
  tooltipProps?: Omit<React.ComponentPropsWithoutRef<typeof Tooltip>, 'children'>;
  tooltipTriggerProps?: React.ComponentPropsWithoutRef<typeof TooltipTrigger>;
} & React.ComponentProps<T>;

function withTooltip<T extends React.ElementType>(Component: T) {
  return function ExtendComponent({
    tooltip,
    title,
    tooltipShortcut,
    tooltipVariant,
    tooltipContentProps,
    tooltipProps,
    tooltipTriggerProps,
    ...props
  }: TooltipProps<T>) {
    return (
      <ToolbarTooltipContainer
        Component={Component}
        componentProps={props as React.ComponentProps<T>}
        tooltip={tooltip ?? title}
        tooltipShortcut={tooltipShortcut}
        tooltipVariant={tooltipVariant}
        tooltipContentProps={tooltipContentProps}
        tooltipProps={tooltipProps}
        tooltipTriggerProps={tooltipTriggerProps}
      />
    );
  };
}

export function ToolbarTooltipContainer<T extends React.ElementType>({
  Component,
  componentProps,
  tooltip,
  tooltipShortcut,
  tooltipVariant,
  tooltipContentProps,
  tooltipProps,
  tooltipTriggerProps,
}: Omit<ToolbarTooltipWrapperViewProps<T>, 'mounted'>) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ToolbarTooltipWrapperView
      Component={Component}
      componentProps={componentProps}
      mounted={mounted}
      tooltip={tooltip}
      tooltipShortcut={tooltipShortcut}
      tooltipVariant={tooltipVariant}
      tooltipContentProps={tooltipContentProps}
      tooltipProps={tooltipProps}
      tooltipTriggerProps={tooltipTriggerProps}
    />
  );
}

interface ToolbarTooltipWrapperViewProps<T extends React.ElementType> {
  Component: T;
  componentProps: React.ComponentProps<T>;
  mounted: boolean;
  tooltip?: React.ReactNode;
  tooltipShortcut?: KeyboardShortcutDefinition;
  tooltipVariant?: TooltipContentProps['variant'];
  tooltipContentProps?: Omit<TooltipContentProps, 'children' | 'shortcut' | 'variant'>;
  tooltipProps?: Omit<React.ComponentPropsWithoutRef<typeof Tooltip>, 'children'>;
  tooltipTriggerProps?: React.ComponentPropsWithoutRef<typeof TooltipTrigger>;
}

function ToolbarTooltipWrapperView<T extends React.ElementType>({
  Component,
  componentProps,
  mounted,
  tooltip,
  tooltipShortcut,
  tooltipVariant,
  tooltipContentProps,
  tooltipProps,
  tooltipTriggerProps,
}: ToolbarTooltipWrapperViewProps<T>) {
  const { disabled, loading } = componentProps as { disabled?: boolean; loading?: boolean };
  const ariaProps = componentProps as Record<string, unknown>;
  const accessibleName =
    typeof ariaProps['aria-label'] === 'string'
      ? ariaProps['aria-label']
      : typeof tooltip === 'string' && !ariaProps['aria-labelledby']
        ? tooltip
        : undefined;
  const usesDisabledTooltipTrigger = Boolean((disabled || loading) && tooltip && mounted);
  const namedComponentProps = {
    ...componentProps,
    ...(accessibleName ? { 'aria-label': accessibleName } : {}),
    ...(usesDisabledTooltipTrigger ? { 'aria-hidden': true, tabIndex: -1 } : {}),
  } as React.ComponentProps<T>;
  const component = <Component {...namedComponentProps} />;
  const trigger = usesDisabledTooltipTrigger ? (
    <span
      className="inline-flex"
      role="button"
      tabIndex={0}
      aria-disabled="true"
      aria-busy={loading || undefined}
      aria-label={accessibleName}
    >
      {component}
    </span>
  ) : (
    component
  );

  if (tooltip && mounted) {
    return (
      <Tooltip shortcut={tooltipShortcut} {...tooltipProps}>
        <TooltipTrigger asChild {...tooltipTriggerProps}>
          {trigger}
        </TooltipTrigger>

        <TooltipContent variant={tooltipVariant} {...tooltipContentProps}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return component;
}

export function ToolbarMenuGroup({
  children,
  className,
  label,
  ...props
}: React.ComponentProps<typeof DropdownMenuRadioGroup> & { label?: string }) {
  return (
    <>
      <DropdownMenuSeparator
        className={cn(
          'hidden',
          'mb-0 shrink-0 peer-has-[[role=menuitem]]/menu-group:block peer-has-[[role=menuitemradio]]/menu-group:block peer-has-[[role=option]]/menu-group:block'
        )}
      />

      <DropdownMenuRadioGroup
        {...props}
        className={cn(
          'hidden',
          'peer/menu-group group/menu-group my-1.5 has-[[role=menuitem]]:block has-[[role=menuitemradio]]:block has-[[role=option]]:block',
          className
        )}
      >
        {label && (
          <DropdownMenuLabel className="text-muted-foreground text-xs font-semibold select-none">
            {label}
          </DropdownMenuLabel>
        )}
        {children}
      </DropdownMenuRadioGroup>
    </>
  );
}

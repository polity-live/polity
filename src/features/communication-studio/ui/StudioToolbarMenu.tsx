import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu';
import { ToolbarButton } from '@/features/shared/ui/layout';
import { cn } from '@/features/shared/utils/utils';

export function StudioToolbarMenu({
  label,
  tooltip = label,
  icon,
  pressed,
  disabled,
  panelKey,
  children,
  className,
  onCloseAutoFocus,
}: {
  label: string;
  tooltip?: string;
  icon: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  panelKey?: string;
  children: ReactNode;
  className?: string;
  onCloseAutoFocus?: ComponentProps<typeof DropdownMenuContent>['onCloseAutoFocus'];
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!panelKey) return;
    const listener = (event: Event) => {
      if ((event as CustomEvent<string>).detail === panelKey) setOpen(true);
    };
    window.addEventListener('studio-open-panel', listener);
    return () => window.removeEventListener('studio-open-panel', listener);
  }, [panelKey]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          type="button"
          aria-label={label}
          tooltip={tooltip}
          isDropdown
          pressed={open || pressed}
          disabled={disabled}
        >
          {icon}
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn(
          'z-[60] max-h-[75dvh] w-max max-w-[calc(100vw-1rem)] min-w-0 overflow-y-auto',
          className
        )}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StudioMenuItem({
  label,
  icon,
  iconOnly = false,
  disabled,
  onSelect,
}: {
  label: string;
  icon: ReactNode;
  iconOnly?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      aria-label={label}
      title={iconOnly ? label : undefined}
      disabled={disabled}
      className={cn('py-1', iconOnly && 'justify-center px-2')}
      onSelect={onSelect}
    >
      {icon}
      {iconOnly ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </DropdownMenuItem>
  );
}

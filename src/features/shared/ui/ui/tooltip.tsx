import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/features/shared/utils/utils.ts';
import {
  type KeyboardShortcutDefinition,
  type ResolvedKeyboardShortcut,
  useResolvedKeyboardShortcut,
} from '@/features/shared/keyboard/keyboard-shortcut';
import { Kbd } from './kbd';
import { useOverlayPortalBoundary } from './overlay-portal-boundary';

const TooltipProviderPresenceContext = React.createContext(false);
const TooltipShortcutContext = React.createContext<ResolvedKeyboardShortcut | undefined>(undefined);

function TooltipProvider({
  delayDuration = 250,
  skipDelayDuration = 300,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipProviderPresenceContext.Provider value>
      <TooltipPrimitive.Provider
        data-slot="tooltip-provider"
        delayDuration={delayDuration}
        skipDelayDuration={skipDelayDuration}
        {...props}
      />
    </TooltipProviderPresenceContext.Provider>
  );
}

function Tooltip({
  shortcut,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root> & {
  shortcut?: KeyboardShortcutDefinition;
}) {
  const hasProvider = React.useContext(TooltipProviderPresenceContext);
  const resolvedShortcut = useResolvedKeyboardShortcut(shortcut);
  const root = (
    <TooltipShortcutContext.Provider value={resolvedShortcut}>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipShortcutContext.Provider>
  );

  return hasProvider ? root : <TooltipProvider>{root}</TooltipProvider>;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const shortcut = React.useContext(TooltipShortcutContext);
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      aria-keyshortcuts={shortcut?.ariaKeyShortcuts}
      {...props}
    />
  );
}

export type TooltipContentProps = React.ComponentProps<typeof TooltipPrimitive.Content> & {
  variant?: 'compact' | 'rich';
  shortcut?: KeyboardShortcutDefinition;
};

function TooltipContent({
  className,
  sideOffset = 8,
  children,
  variant = 'compact',
  shortcut: shortcutOverride,
  ...props
}: TooltipContentProps) {
  const { container } = useOverlayPortalBoundary();
  const shortcutFromRoot = React.useContext(TooltipShortcutContext);
  const resolvedShortcutOverride = useResolvedKeyboardShortcut(shortcutOverride);
  const shortcut = resolvedShortcutOverride ?? shortcutFromRoot;
  return (
    <TooltipPrimitive.Portal container={container ?? undefined}>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionBoundary={container ?? undefined}
        className={cn(
          'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md border border-[var(--tooltip-border)] bg-[var(--tooltip)] text-xs text-[var(--tooltip-foreground)] shadow-[var(--shadow-panel)] motion-reduce:animate-none',
          variant === 'compact' && 'max-w-64 px-3 py-1.5 text-balance',
          variant === 'rich' && 'max-w-80 p-3 text-left',
          className
        )}
        {...props}
      >
        <div className={cn('flex items-center gap-2', variant === 'rich' && 'items-start')}>
          <div className={cn(variant === 'rich' && 'min-w-0 flex-1')}>{children}</div>
          {shortcut?.display ? (
            <Kbd className="shrink-0 border-[var(--tooltip-shortcut-border)] bg-[var(--tooltip-shortcut-bg)] text-[var(--tooltip-foreground)]">
              {shortcut.display}
            </Kbd>
          ) : null}
        </div>
        <TooltipPrimitive.Arrow className="z-50 size-2.5 fill-[var(--tooltip)]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

function TooltipHint({
  children,
  content,
  shortcut,
  variant,
  disabled = false,
  ...contentProps
}: {
  children: React.ReactElement;
  content: React.ReactNode;
  shortcut?: KeyboardShortcutDefinition;
  variant?: TooltipContentProps['variant'];
  disabled?: boolean;
} & Omit<TooltipContentProps, 'children' | 'shortcut' | 'variant'>) {
  if (disabled) {
    return children;
  }

  return (
    <Tooltip shortcut={shortcut}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent variant={variant} {...contentProps}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipHint, TooltipProvider };

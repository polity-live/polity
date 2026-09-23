import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogTitle } from '@/features/shared/ui/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/features/shared/ui/ui/sheet';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/features/shared/ui/ui/popover';
import { ToolbarButton } from '@/features/shared/ui/layout';
import { cn } from '@/features/shared/utils/utils';
import { parseStudioOpenPanelRequest, STUDIO_OPEN_PANEL_EVENT } from '../logic/panel-events';

type PanelPlacement = 'toolbar' | 'sidebar' | 'mobile';

export function useStudioMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const q = matchMedia('(max-width: 767px)'),
      sync = () => setMobile(q.matches);
    sync();
    q.addEventListener('change', sync);
    return () => q.removeEventListener('change', sync);
  }, []);
  return mobile;
}

function findVisibleNavigationAnchor(navigationItemId?: string) {
  if (!navigationItemId) return null;
  return (
    [...document.querySelectorAll<HTMLElement>('[data-navigation-item-id]')].find(element => {
      if (element.dataset.navigationItemId !== navigationItemId) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) ?? null
  );
}

function isRightSidebarAnchor(anchor: HTMLElement) {
  const navigation = anchor.closest<HTMLElement>('[data-navigation-type="secondary"]');
  if (!navigation) return false;
  const rect = navigation.getBoundingClientRect();
  return rect.width > 0 && rect.height > rect.width && rect.left >= window.innerWidth / 2;
}

export function StudioPanel({
  label,
  icon,
  pressed,
  children,
  large = false,
  compact = false,
  panelKey,
  toolbarTrigger = true,
  keepOpenOnCanvasInteraction = false,
}: {
  label: string;
  icon?: ReactNode;
  pressed?: boolean;
  children: ReactNode;
  large?: boolean;
  compact?: boolean;
  panelKey?: string;
  toolbarTrigger?: boolean;
  keepOpenOnCanvasInteraction?: boolean;
}) {
  const mobile = useStudioMobile();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<PanelPlacement>('toolbar');
  const [container] = useState(() =>
    typeof document === 'undefined' ? null : document.createElement('div')
  );
  const trigger = useRef<HTMLElement | null>(null);
  const navigationAnchor = useRef<HTMLElement | null>(null);
  const restoreNavigationFocus = useRef(true);

  const change = (next: boolean, nextPlacement = placement) => {
    if (next) {
      trigger.current = document.activeElement as HTMLElement;
      setPlacement(nextPlacement);
    }
    setOpen(next);
    window.dispatchEvent(new CustomEvent('studio-panel', { detail: next }));
  };

  useEffect(
    () => () => {
      if (open) window.dispatchEvent(new CustomEvent('studio-panel', { detail: false }));
    },
    [open]
  );

  useEffect(() => {
    const listener = (event: Event) => {
      const request = parseStudioOpenPanelRequest((event as CustomEvent).detail);
      if (!request) return;

      if (request.panelKey !== panelKey) {
        if (request.origin === 'secondary-navigation' && open && placement === 'sidebar') {
          restoreNavigationFocus.current = false;
          change(false);
        }
        return;
      }

      if (request.origin === 'secondary-navigation') {
        const anchor = findVisibleNavigationAnchor(request.navigationItemId);
        navigationAnchor.current = anchor;
        restoreNavigationFocus.current = true;
        if (anchor && isRightSidebarAnchor(anchor)) {
          trigger.current = anchor;
          change(true, 'sidebar');
          return;
        }
        if (anchor) {
          trigger.current = anchor;
          change(true, 'mobile');
          return;
        }
      }

      navigationAnchor.current = null;
      change(true, 'toolbar');
    };
    window.addEventListener(STUDIO_OPEN_PANEL_EVENT, listener);
    return () => window.removeEventListener(STUDIO_OPEN_PANEL_EVENT, listener);
  }, [open, panelKey, placement]);

  const mount = (node: HTMLDivElement | null) => {
    if (node && container) node.appendChild(container);
  };
  const restoreToolbarFocus = (event: Event) => {
    event.preventDefault();
    trigger.current?.focus();
  };
  const restoreSidebarFocus = (event: Event) => {
    event.preventDefault();
    if (restoreNavigationFocus.current) navigationAnchor.current?.focus();
    restoreNavigationFocus.current = true;
  };
  const content = <div ref={mount} />;
  const triggerContent = icon ?? label;
  const toolbarPopover = !mobile && !large;
  const toolbarOpen = open && placement === 'toolbar' && toolbarTrigger;
  const mobileOpen = open && placement === 'mobile';
  const sidebarOpen = open && placement === 'sidebar';

  return (
    <>
      {container && createPortal(children, container)}
      {toolbarTrigger &&
        (toolbarPopover ? (
          <Popover
            open={toolbarOpen}
            onOpenChange={next => {
              if (next) change(true, 'toolbar');
              else if (placement === 'toolbar') change(false);
            }}
          >
            <PopoverTrigger asChild>
              <ToolbarButton tooltip={label} isDropdown pressed={pressed || open}>
                {triggerContent}
              </ToolbarButton>
            </PopoverTrigger>
            <PopoverContent
              className="z-[60] max-h-[75vh] w-[min(28rem,90vw)] overflow-auto"
              align="start"
              onCloseAutoFocus={restoreToolbarFocus}
            >
              {content}
            </PopoverContent>
          </Popover>
        ) : (
          <ToolbarButton
            tooltip={label}
            isDropdown
            pressed={pressed || open}
            onClick={() => change(true, 'toolbar')}
          >
            {triggerContent}
          </ToolbarButton>
        ))}

      <Popover
        open={sidebarOpen}
        onOpenChange={next => {
          if (!next && placement === 'sidebar') {
            restoreNavigationFocus.current = true;
            change(false);
          }
        }}
      >
        <PopoverAnchor virtualRef={navigationAnchor} />
        <PopoverContent
          aria-label={label}
          side="left"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          updatePositionStrategy="always"
          onCloseAutoFocus={restoreSidebarFocus}
          onInteractOutside={event => {
            if (
              keepOpenOnCanvasInteraction &&
              event.target instanceof Element &&
              event.target.closest('[data-canvas-engine="konva"]')
            )
              event.preventDefault();
          }}
          className={cn(
            'max-h-[calc(100dvh-1rem)] overflow-auto p-2',
            compact
              ? 'w-80 max-w-[calc(100vw-5rem)]'
              : large
                ? 'w-[min(56rem,calc(100vw-5rem))]'
                : 'w-[min(28rem,calc(100vw-5rem))]'
          )}
        >
          {content}
        </PopoverContent>
      </Popover>

      {mobile || mobileOpen ? (
        <Sheet
          open={(toolbarOpen && mobile) || mobileOpen}
          onOpenChange={next => {
            if (!next && (placement === 'toolbar' || placement === 'mobile')) change(false);
          }}
        >
          <SheetContent
            onCloseAutoFocus={restoreToolbarFocus}
            side="bottom"
            className="z-[60] max-h-[85dvh] overflow-auto"
          >
            <SheetTitle>{label}</SheetTitle>
            {content}
          </SheetContent>
        </Sheet>
      ) : large ? (
        <Dialog
          open={toolbarOpen}
          onOpenChange={next => {
            if (!next && placement === 'toolbar') change(false);
          }}
        >
          <DialogContent
            onCloseAutoFocus={restoreToolbarFocus}
            className="z-[60] max-h-[85dvh] max-w-4xl overflow-auto"
          >
            <DialogTitle>{label}</DialogTitle>
            {content}
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';

const TOOLTIP_DATA_ATTRIBUTE = 'data-polity-editor-tooltip';
const TOOLTIP_DELAY_MS = 250;
const EDITOR_PORTAL_SELECTOR = [
  '#SfxPopper',
  '#SfxPopup',
  '#SfxModal',
  '#SfxDrawer',
  '.SfxPopper-wrapper',
  '.SfxPopper-root',
  '.SfxMenu-root',
  '.SfxPopup-root',
  '.SfxModal-root',
  '.SfxDrawer-root',
  '[data-tippy-root]',
].join(',');

interface MigratedTitle {
  ariaLabelAdded: boolean;
  title: string;
}

interface ActiveTooltip {
  rect: DOMRect;
  target: HTMLElement;
  text: string;
}

function isInteractiveElement(element: HTMLElement) {
  return (
    element.matches('button, input, select, textarea, a[href], [role="button"], [tabindex]') &&
    !element.hasAttribute('aria-label') &&
    !element.hasAttribute('aria-labelledby')
  );
}

function hasExistingAccessibleName(element: HTMLElement) {
  if (element.textContent?.trim()) return true;
  if ('labels' in element) {
    const labels = (element as HTMLInputElement).labels;
    if (labels?.length) return true;
  }
  return false;
}

function getTooltipElement(target: EventTarget | null) {
  return target instanceof Element
    ? (target.closest(`[${TOOLTIP_DATA_ATTRIBUTE}]`) as HTMLElement | null)
    : null;
}

export function ImageEditorTooltipBridge({
  hostRef,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
}) {
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null);
  const activeTooltipRef = useRef<ActiveTooltip | null>(null);

  useEffect(() => {
    activeTooltipRef.current = activeTooltip;
  }, [activeTooltip]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    document.documentElement.setAttribute('data-polity-image-editor-open', 'true');

    const migratedTitles = new Map<HTMLElement, MigratedTitle>();
    let showTimer: number | undefined;
    let pendingTarget: HTMLElement | null = null;

    const belongsToEditor = (element: Element) =>
      host.contains(element) || Boolean(element.closest(EDITOR_PORTAL_SELECTOR));

    const migrateTitle = (element: HTMLElement) => {
      if (!belongsToEditor(element)) return;
      const title = element.getAttribute('title')?.trim();
      if (!title) return;

      const previous = migratedTitles.get(element);
      const ariaLabelAdded =
        previous?.ariaLabelAdded ??
        (isInteractiveElement(element) && !hasExistingAccessibleName(element));

      migratedTitles.set(element, { ariaLabelAdded, title });
      element.setAttribute(TOOLTIP_DATA_ATTRIBUTE, title);
      if (ariaLabelAdded) element.setAttribute('aria-label', title);
      element.removeAttribute('title');
    };

    const migrateTree = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.hasAttribute('title')) migrateTitle(node);
      node.querySelectorAll<HTMLElement>('[title]').forEach(migrateTitle);
    };

    const clearShowTimer = () => {
      if (showTimer !== undefined) window.clearTimeout(showTimer);
      showTimer = undefined;
      pendingTarget = null;
    };

    const hideTooltip = (target?: HTMLElement | null) => {
      if (target && pendingTarget !== target && activeTooltipRef.current?.target !== target) {
        return;
      }
      clearShowTimer();
      activeTooltipRef.current = null;
      setActiveTooltip(null);
    };

    const scheduleTooltip = (target: HTMLElement | null) => {
      if (!target || !belongsToEditor(target)) return;
      const text = target.getAttribute(TOOLTIP_DATA_ATTRIBUTE)?.trim();
      if (!text) return;
      if (activeTooltipRef.current?.target === target || pendingTarget === target) return;

      clearShowTimer();
      pendingTarget = target;
      showTimer = window.setTimeout(() => {
        if (!target.isConnected) return hideTooltip(target);
        const nextTooltip = { target, text, rect: target.getBoundingClientRect() };
        pendingTarget = null;
        showTimer = undefined;
        activeTooltipRef.current = nextTooltip;
        setActiveTooltip(nextTooltip);
      }, TOOLTIP_DELAY_MS);
    };

    const handlePointerOver = (event: PointerEvent) => {
      const target = getTooltipElement(event.target);
      const relatedTarget = getTooltipElement(event.relatedTarget);
      if (target !== relatedTarget) scheduleTooltip(target);
    };

    const handlePointerOut = (event: PointerEvent) => {
      const target = getTooltipElement(event.target);
      const relatedTarget = getTooltipElement(event.relatedTarget);
      if (target !== relatedTarget) hideTooltip(target);
    };

    const handleFocusIn = (event: FocusEvent) => scheduleTooltip(getTooltipElement(event.target));

    const handleFocusOut = (event: FocusEvent) => {
      const target = getTooltipElement(event.target);
      const relatedTarget = getTooltipElement(event.relatedTarget);
      if (target !== relatedTarget) hideTooltip(target);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hideTooltip();
    };

    migrateTree(host);
    document.querySelectorAll<HTMLElement>(EDITOR_PORTAL_SELECTOR).forEach(migrateTree);

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes') {
          migrateTitle(mutation.target as HTMLElement);
          return;
        }
        mutation.addedNodes.forEach(migrateTree);
      });
    });

    observer.observe(document.body, {
      attributeFilter: ['title'],
      attributes: true,
      childList: true,
      subtree: true,
    });

    document.addEventListener('pointerover', handlePointerOver, true);
    document.addEventListener('pointerout', handlePointerOut, true);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      clearShowTimer();
      observer.disconnect();
      document.removeEventListener('pointerover', handlePointerOver, true);
      document.removeEventListener('pointerout', handlePointerOut, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.documentElement.removeAttribute('data-polity-image-editor-open');

      migratedTitles.forEach(({ ariaLabelAdded, title }, element) => {
        if (!element.isConnected) return;
        element.removeAttribute(TOOLTIP_DATA_ATTRIBUTE);
        if (!element.hasAttribute('title')) element.setAttribute('title', title);
        if (ariaLabelAdded && element.getAttribute('aria-label') === title) {
          element.removeAttribute('aria-label');
        }
      });
    };
  }, [hostRef]);

  useEffect(() => {
    if (!activeTooltip) return;

    const updatePosition = () => {
      if (!activeTooltip.target.isConnected) {
        activeTooltipRef.current = null;
        setActiveTooltip(null);
        return;
      }
      setActiveTooltip(current =>
        current?.target === activeTooltip.target
          ? { ...current, rect: current.target.getBoundingClientRect() }
          : current
      );
    };

    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
    };
  }, [activeTooltip?.target]);

  if (!activeTooltip) return null;

  const triggerStyle: CSSProperties = {
    position: 'fixed',
    left: activeTooltip.rect.left,
    top: activeTooltip.rect.top,
    width: activeTooltip.rect.width,
    height: activeTooltip.rect.height,
    opacity: 0,
    pointerEvents: 'none',
    zIndex: -1,
  };

  return (
    <Tooltip open>
      <TooltipTrigger asChild>
        <span aria-hidden style={triggerStyle} />
      </TooltipTrigger>
      <TooltipContent>{activeTooltip.text}</TooltipContent>
    </Tooltip>
  );
}

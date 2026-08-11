'use client';

import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  LoaderCircle,
  MousePointerClick,
  RotateCw,
} from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';

import { useScreenStore } from '@/features/shared/global-state/screen.store';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { cn } from '@/features/shared/utils/utils';
import { localizeAppError } from '@/features/shared/errors/app-error';
import type { PublicAppTutorialRun } from '@/server/app-tutorial/service';
import { advanceTutorial, loadTutorialRun, pauseTutorial, restartTutorial } from './api';
import {
  getAppTutorialCheckpoint,
  localizeAppTutorialExpectedInput,
  localizeAppTutorialText,
  matchesAppTutorialExpectedInput,
  type AppTutorialCheckpointId,
  type AppTutorialCompletion,
} from './catalog';
import {
  APP_TUTORIAL_ACTION_EVENT,
  APP_TUTORIAL_ACTIVE_BODY_ATTRIBUTE,
  APP_TUTORIAL_OSM_LOAD_FAILED_ACTION,
  APP_TUTORIAL_SPOTLIGHT_TARGET_EVENT,
  requestAppTutorialNetworkApproval,
  requestAppTutorialTargetRecovery,
} from './events';
import { tutorialRouteMatches } from './logic/tutorialRoute';

const SPOTLIGHT_PADDING = 6;
const SPOTLIGHT_ANIMATION_TRACKING_FRAMES = 30;
const TARGET_RETRY_DELAY_MS = 8_000;
const CONFIRMED_NETWORK_RETRY_DELAY_MS = 10_000;
const PROCESS_PATH_RETRY_DELAY_MS = 10_000;
const PRIMARY_NAVIGATION_SCROLLER_SELECTOR =
  '[data-tutorial-horizontal-scroller="primary-navigation"]';
const CITY_DESIGN_TOOLBAR_SCROLLER_SELECTOR =
  '[data-tutorial-horizontal-scroller="city-design-toolbar"]';
const MOBILE_PRIMARY_SEARCH_ANCHOR = 'primary-search';
const MOBILE_CITY_DESIGN_TREES_ANCHOR = 'city-design-trees-menu';
const MOBILE_CITY_DESIGN_SAVE_ANCHOR = 'city-design-save';
const TUTORIAL_SEARCH_RESULT_ANCHOR = 'tutorial-search-result';
const LINK_SURFACE_PRIMARY_SELECTOR = '[data-link-surface-primary]';
const CURRENT_TUTORIAL_TARGET_ATTRIBUTE = 'data-tutorial-current-target';
const TUTORIAL_INPUT_VALUES_ATTRIBUTE = 'data-tutorial-input-values';

function tutorialNavigationOptions(route: string) {
  const url = new URL(route, 'https://polity.local');
  return {
    to: url.pathname as never,
    search: Object.fromEntries(url.searchParams) as never,
    replace: true,
  } as const;
}

const SPOTLIGHT_DROPDOWN_ANCHORS = new Set([
  'network-group-search',
  'city-design-location-search',
  'tutorial-process-start-group',
  'tutorial-process-target-group',
]);
const TUTORIAL_DROPDOWN_SELECTOR = '[role="listbox"],[data-typeahead-dropdown]';
const SPOTLIGHT_EXACT_ANCHORS = new Set(['agenda-amendment-yes']);
const SPOTLIGHT_ANIMATED_ANCHORS = new Set([
  'agenda-amendment-yes',
  'agenda-amendment-password',
  'agenda-election-password',
]);
const RECOVERABLE_VOTING_ANCHORS = new Set([
  'agenda-amendment-yes',
  'agenda-amendment-submit',
  'agenda-amendment-password',
  'agenda-election-option',
  'agenda-election-submit',
  'agenda-election-password',
]);
const VOTING_SELECTION_RECOVERY_ANCHORS = new Set([
  'agenda-amendment-submit',
  'agenda-election-submit',
]);
const CHECKPOINT_SPOTLIGHT_ANCHORS: Partial<Record<AppTutorialCheckpointId, readonly string[]>> = {
  'link-climate-council': ['network-group-search', 'link-group'],
  'request-climate-council-rights': ['network-rights-selector', 'link-group'],
};

const tutorialLabelKeys = {
  understand: 'features.appTutorial.orchestrator.understand',
  continue: 'features.appTutorial.orchestrator.continue',
  leave: 'features.appTutorial.orchestrator.leave',
  restart: 'features.appTutorial.orchestrator.restart',
  retry: 'features.appTutorial.orchestrator.retry',
  missingTitle: 'features.appTutorial.orchestrator.missingTitle',
  missingBody: 'features.appTutorial.orchestrator.missingBody',
  conflict: 'features.appTutorial.orchestrator.conflict',
  waitingForMembership: 'features.appTutorial.orchestrator.waitingForMembership',
  waitingForNetwork: 'features.appTutorial.orchestrator.waitingForNetwork',
  loadingConfirmedNetwork: 'features.appTutorial.orchestrator.loadingConfirmedNetwork',
  loadingAmendment: 'features.appTutorial.orchestrator.loadingAmendment',
  copy: 'features.appTutorial.orchestrator.copy',
  copied: 'features.appTutorial.orchestrator.copied',
  copyFailed: 'features.appTutorial.orchestrator.copyFailed',
  showDetails: 'features.appTutorial.orchestrator.showDetails',
  hideDetails: 'features.appTutorial.orchestrator.hideDetails',
  minimizeInstruction: 'features.appTutorial.orchestrator.minimizeInstruction',
  showInstruction: 'features.appTutorial.orchestrator.showInstruction',
  mobileDesktopHint: 'features.appTutorial.orchestrator.mobileDesktopHint',
  osmLoadFailed: 'features.appTutorial.orchestrator.osmLoadFailed',
  retryOsm: 'features.appTutorial.orchestrator.retryOsm',
} as const;

export function tutorialSpotlightRectFor(element: HTMLElement | null, anchor = '') {
  if (!element) return null;
  const bounds = [element.getBoundingClientRect()];
  const padding = SPOTLIGHT_EXACT_ANCHORS.has(anchor) ? 0 : SPOTLIGHT_PADDING;
  for (const dropdown of visibleTutorialDropdownsFor(element, anchor)) {
    bounds.push(dropdown.getBoundingClientRect());
  }
  const top = Math.max(0, Math.min(...bounds.map(value => value.top)) - padding);
  const left = Math.max(0, Math.min(...bounds.map(value => value.left)) - padding);
  const right = Math.min(
    window.innerWidth,
    Math.max(...bounds.map(value => value.right)) + padding
  );
  const bottom = Math.min(
    window.innerHeight,
    Math.max(...bounds.map(value => value.bottom)) + padding
  );
  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

type SpotlightRect = ReturnType<typeof tutorialSpotlightRectFor>;
type TutorialMoveResult = 'advanced' | 'failed' | 'pending';

function spotlightRectsAreEqual(left: SpotlightRect, right: SpotlightRect) {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.top === right.top &&
    left.left === right.left &&
    left.right === right.right &&
    left.bottom === right.bottom &&
    left.width === right.width &&
    left.height === right.height
  );
}

function visibleTutorialDropdownsFor(element: HTMLElement | null, anchor: string) {
  if (!element || !SPOTLIGHT_DROPDOWN_ANCHORS.has(anchor)) return [];

  const dialog = element.closest<HTMLElement>('[data-slot="dialog-content"]');
  const localDropdowns = new Set([
    ...element.querySelectorAll<HTMLElement>(TUTORIAL_DROPDOWN_SELECTOR),
    ...(dialog?.querySelectorAll<HTMLElement>(TUTORIAL_DROPDOWN_SELECTOR) ?? []),
  ]);
  const candidates =
    localDropdowns.size > 0
      ? localDropdowns
      : new Set(document.querySelectorAll<HTMLElement>(TUTORIAL_DROPDOWN_SELECTOR));

  return Array.from(candidates).filter(dropdown => {
    const bounds = dropdown.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0;
  });
}

function SpotlightSurfaces({ rect }: { rect: NonNullable<SpotlightRect> }) {
  const surface = 'pointer-events-none fixed z-[2147483000] bg-black/40 backdrop-blur-[1px]';
  return (
    <>
      <div className={surface} style={{ inset: `0 0 auto 0`, height: rect.top }} />
      <div
        className={surface}
        style={{
          top: rect.top,
          left: 0,
          width: rect.left,
          height: Math.max(0, rect.bottom - rect.top),
        }}
      />
      <div
        className={surface}
        style={{
          top: rect.top,
          left: rect.right,
          right: 0,
          height: Math.max(0, rect.bottom - rect.top),
        }}
      />
      <div className={surface} style={{ inset: `${rect.bottom}px 0 0 0` }} />
    </>
  );
}

function SpotlightTargetOutline({ rect }: { rect: NonNullable<SpotlightRect> }) {
  return (
    <div
      data-testid="app-tutorial-target-outline"
      className="border-primary pointer-events-none fixed z-[2147483050] rounded-md border-2 shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
      style={{
        top: rect.top,
        left: rect.left,
        width: Math.max(0, rect.right - rect.left),
        height: Math.max(0, rect.bottom - rect.top),
      }}
      aria-hidden="true"
    />
  );
}

export function mobileDetailsOpenByDefault(completion: AppTutorialCompletion) {
  return (
    completion.type === 'acknowledge' ||
    completion.type === 'view' ||
    completion.type === 'automatic'
  );
}

function matchesCompletionInput(
  actual: string,
  completion: Extract<AppTutorialCompletion, { type: 'input' }>
): boolean {
  return matchesAppTutorialExpectedInput(actual, completion.expectedInputKey);
}

function matchesCompletionActionValue(
  actual: string,
  completion: Extract<AppTutorialCompletion, { type: 'action' }>
): boolean {
  if (completion.expectedInputKey) {
    return matchesAppTutorialExpectedInput(actual, completion.expectedInputKey);
  }
  return true;
}

export function tutorialInputValuesFor(target: HTMLElement): readonly string[] {
  const serializedValues = target.getAttribute(TUTORIAL_INPUT_VALUES_ATTRIBUTE);
  if (!serializedValues) return [];
  try {
    const values: unknown = JSON.parse(serializedValues);
    return Array.isArray(values)
      ? values.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

export function tutorialCardStyle(
  rect: NonNullable<SpotlightRect>,
  checkpointId?: AppTutorialCheckpointId,
  isMobile = false,
  collapsed = false
) {
  const width = Math.min(380, Math.max(0, window.innerWidth - 24));
  if (isMobile) {
    const viewportWidth = Math.max(0, window.visualViewport?.width ?? window.innerWidth);
    const viewportLeft = window.visualViewport?.offsetLeft ?? 0;
    const mobileWidth = Math.min(380, Math.max(0, viewportWidth - 24));
    const left = viewportLeft + Math.max(12, (viewportWidth - mobileWidth) / 2);
    const primaryNavigation =
      Array.from(document.querySelectorAll<HTMLElement>('[data-navigation-type="primary"]'))
        .filter(element => {
          const bounds = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return bounds.width > 0 && bounds.height > 0 && style.display !== 'none';
        })
        .at(-1) ?? null;
    const navigationBounds = primaryNavigation?.getBoundingClientRect();
    const navigationHeight = navigationBounds?.height || 76;
    const spotlightCenter = rect.top + rect.height / 2;
    const placeAtTop = spotlightCenter >= (window.innerHeight * 2) / 3;
    const size = collapsed
      ? { height: navigationHeight, maxHeight: navigationHeight }
      : { maxHeight: 'min(50dvh, 24rem)' };

    if (!placeAtTop) {
      const measuredBottomClearance = navigationBounds
        ? Math.max(0, window.innerHeight - navigationBounds.top) + 12
        : null;
      return {
        width: mobileWidth,
        left,
        bottom:
          measuredBottomClearance === null
            ? 'calc(88px + env(safe-area-inset-bottom))'
            : measuredBottomClearance,
        ...size,
      };
    }
    return {
      width: mobileWidth,
      left,
      top: 'calc(12px + env(safe-area-inset-top))',
      ...size,
    };
  }
  if (checkpointId === 'add-tree-row') {
    return {
      width,
      right: 12,
      bottom: window.matchMedia('(min-width: 768px)').matches ? 12 : 76,
    };
  }
  const horizontalGap = 12;
  const estimatedHeight = 400;
  const clampedTop = Math.min(
    Math.max(12, rect.top),
    Math.max(12, window.innerHeight - estimatedHeight - 12)
  );
  if (window.innerWidth - rect.right >= width + horizontalGap * 2) {
    return { width, top: clampedTop, left: rect.right + horizontalGap };
  }
  if (rect.left >= width + horizontalGap * 2) {
    return { width, top: clampedTop, left: rect.left - width - horizontalGap };
  }
  const below = rect.bottom + 12;
  const availableBelow = window.innerHeight - below;
  const preferredTop =
    availableBelow >= estimatedHeight
      ? below
      : Math.max(12, rect.top - estimatedHeight - horizontalGap);
  const top = Math.min(
    Math.max(12, preferredTop),
    Math.max(12, window.innerHeight - estimatedHeight - 12)
  );
  const left = Math.min(
    Math.max(12, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - width - 12
  );
  return { width, top, left };
}

function TutorialCoachCard({
  children,
  rect,
  checkpointId,
  isMobile,
  collapsed,
}: {
  children: ReactNode;
  rect: NonNullable<SpotlightRect>;
  checkpointId: AppTutorialCheckpointId;
  isMobile: boolean;
  collapsed: boolean;
}) {
  const [positionRect, setPositionRect] = useState(rect);
  const latestRectRef = useRef(rect);
  const pointerActiveRef = useRef(false);
  const releaseFrameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    latestRectRef.current = rect;
    if (!pointerActiveRef.current) {
      setPositionRect(current => (spotlightRectsAreEqual(current, rect) ? current : rect));
    }
  }, [rect]);

  const releasePointerFreeze = useCallback(() => {
    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;
    if (releaseFrameRef.current !== null) {
      window.cancelAnimationFrame(releaseFrameRef.current);
    }
    releaseFrameRef.current = window.requestAnimationFrame(() => {
      releaseFrameRef.current = null;
      setPositionRect(current =>
        spotlightRectsAreEqual(current, latestRectRef.current) ? current : latestRectRef.current
      );
    });
  }, []);

  const freezePointerPosition = () => {
    pointerActiveRef.current = true;
  };

  useEffect(() => {
    window.addEventListener('pointerup', releasePointerFreeze);
    window.addEventListener('pointercancel', releasePointerFreeze);
    return () => {
      window.removeEventListener('pointerup', releasePointerFreeze);
      window.removeEventListener('pointercancel', releasePointerFreeze);
      if (releaseFrameRef.current !== null) {
        window.cancelAnimationFrame(releaseFrameRef.current);
      }
    };
  }, [releasePointerFreeze]);

  return (
    <Card
      data-testid="app-tutorial-coach-card"
      data-tutorial-overlay-allowed
      className={cn(
        'pointer-events-auto fixed z-[2147483100] [scrollbar-gutter:stable] overflow-y-auto shadow-2xl',
        isMobile && 'min-w-0 overflow-x-hidden'
      )}
      style={tutorialCardStyle(positionRect, checkpointId, isMobile, collapsed)}
      onPointerDownCapture={freezePointerPosition}
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-tutorial-title"
    >
      {children}
    </Card>
  );
}

export function horizontalScrollerFor(target: HTMLElement) {
  const explicitScroller = target.matches(PRIMARY_NAVIGATION_SCROLLER_SELECTOR)
    ? target
    : target.querySelector<HTMLElement>(PRIMARY_NAVIGATION_SCROLLER_SELECTOR);
  if (explicitScroller) return explicitScroller;

  const candidates = [target, ...Array.from(target.querySelectorAll<HTMLElement>('*'))];
  return (
    candidates.find(element => {
      const style = window.getComputedStyle(element);
      return (
        element.scrollWidth > element.clientWidth &&
        (style.overflowX === 'auto' || style.overflowX === 'scroll')
      );
    }) ?? target
  );
}

function mobileHorizontalScrollerSelector(anchor: string) {
  if (anchor === MOBILE_PRIMARY_SEARCH_ANCHOR) return PRIMARY_NAVIGATION_SCROLLER_SELECTOR;
  if (anchor === MOBILE_CITY_DESIGN_TREES_ANCHOR || anchor === MOBILE_CITY_DESIGN_SAVE_ANCHOR) {
    return CITY_DESIGN_TOOLBAR_SCROLLER_SELECTOR;
  }
  return null;
}

export function centerMobileTutorialTarget(target: HTMLElement, anchor: string, isMobile: boolean) {
  if (!isMobile) return false;

  const scrollerSelector = mobileHorizontalScrollerSelector(anchor);
  if (!scrollerSelector) return false;

  const scroller = target.closest<HTMLElement>(scrollerSelector);
  if (!scroller) return false;

  const maximumScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  if (maximumScrollLeft === 0) return false;

  const targetRect = target.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const visibleLeft = Math.max(0, scrollerRect.left);
  const visibleRight = Math.min(window.innerWidth, scrollerRect.right);
  if (targetRect.left >= visibleLeft && targetRect.right <= visibleRight) return false;

  const targetCenter = targetRect.left + targetRect.width / 2;
  const scrollerCenter = visibleLeft + Math.max(0, visibleRight - visibleLeft) / 2;
  const centeredScrollLeft = scroller.scrollLeft + targetCenter - scrollerCenter;
  const left = Math.min(maximumScrollLeft, Math.max(0, centeredScrollLeft));

  // Assigning scrollLeft also works in older mobile webviews where the
  // options overload of Element.scrollTo may silently do nothing.
  scroller.scrollLeft = left;
  scroller.scrollTo({ behavior: 'auto', left });
  return true;
}

export function visibleTutorialTarget(anchor: string) {
  return (
    Array.from(
      document.querySelectorAll<HTMLElement>(`[data-tutorial-anchor="${CSS.escape(anchor)}"]`)
    )
      .map(element =>
        anchor === TUTORIAL_SEARCH_RESULT_ANCHOR
          ? (element.querySelector<HTMLElement>(LINK_SURFACE_PRIMARY_SELECTOR) ?? element)
          : element
      )
      .filter(element => {
        const bounds = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const menuIsLoading =
          anchor === 'avatar-profile' &&
          Boolean(
            element
              .closest('[role="menu"]')
              ?.querySelector('[data-testid="user-menu-navigation-loading"]')
          );
        return bounds.width > 0 && bounds.height > 0 && style.display !== 'none' && !menuIsLoading;
      })
      .at(-1) ?? null
  );
}

export function tutorialTargetIsLoading(anchor: string) {
  const explicitLoadingTarget = document.querySelector(
    `[data-tutorial-loading-anchor="${CSS.escape(anchor)}"]`
  );
  if (explicitLoadingTarget) return true;

  return (
    anchor === 'avatar-profile' &&
    Array.from(
      document.querySelectorAll<HTMLElement>(`[data-tutorial-anchor="${CSS.escape(anchor)}"]`)
    ).some(element =>
      Boolean(
        element
          .closest('[role="menu"]')
          ?.querySelector('[data-testid="user-menu-navigation-loading"]')
      )
    )
  );
}

function useSpotlightTarget(
  anchorCandidates: readonly string[],
  enabled: boolean,
  routeKey: string,
  isMobile: boolean
) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [targetAnchor, setTargetAnchor] = useState('');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [rect, setRect] = useState<SpotlightRect>(null);
  const [missing, setMissing] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const settleTimeoutRef = useRef<number | null>(null);
  const publishFrameRef = useRef<number | null>(null);
  const resolvedTargetRef = useRef<HTMLElement | null>(null);
  const resolvedAnchorRef = useRef('');

  const resolveTarget = useCallback(() => {
    for (const anchor of anchorCandidates) {
      const element = visibleTutorialTarget(anchor);
      if (element) return { anchor, element };
    }
    return { anchor: anchorCandidates[0] as string, element: null };
  }, [anchorCandidates]);

  const publishTarget = useCallback((element: HTMLElement | null, anchor: string) => {
    if (resolvedTargetRef.current !== element || resolvedAnchorRef.current !== anchor) return;
    setTarget(element);
    setTargetAnchor(anchor);
    setDropdownVisible(visibleTutorialDropdownsFor(element, anchor).length > 0);
    const nextRect = tutorialSpotlightRectFor(element, anchor);
    setRect(current => (spotlightRectsAreEqual(current, nextRect) ? current : nextRect));
    setMissing(current => (element ? false : current));
  }, []);

  const find = useCallback(() => {
    const commit = () => {
      const next = resolveTarget();
      const targetChanged =
        next.element !== resolvedTargetRef.current || next.anchor !== resolvedAnchorRef.current;
      resolvedTargetRef.current = next.element;
      resolvedAnchorRef.current = next.anchor;

      if (!targetChanged) {
        if (SPOTLIGHT_DROPDOWN_ANCHORS.has(next.anchor)) {
          publishTarget(next.element, next.anchor);
        }
        return;
      }

      if (publishFrameRef.current !== null) {
        window.cancelAnimationFrame(publishFrameRef.current);
        publishFrameRef.current = null;
      }

      if (!next.element) {
        publishTarget(null, next.anchor);
        return;
      }

      next.element.scrollIntoView({
        behavior: 'auto',
        block: 'center',
        inline: isMobile ? 'nearest' : 'center',
      });
      const mobileScrollerSelector = mobileHorizontalScrollerSelector(next.anchor);
      const waitForMobileHorizontalLayout =
        isMobile &&
        Boolean(
          mobileScrollerSelector && next.element.closest<HTMLElement>(mobileScrollerSelector)
        );
      publishFrameRef.current = window.requestAnimationFrame(() => {
        publishFrameRef.current = null;
        if (!waitForMobileHorizontalLayout) {
          publishTarget(next.element, next.anchor);
          return;
        }
        centerMobileTutorialTarget(next.element, next.anchor, isMobile);
        publishFrameRef.current = window.requestAnimationFrame(() => {
          publishFrameRef.current = null;
          publishTarget(next.element, next.anchor);
        });
      });
    };

    if (anchorCandidates.includes('avatar-profile')) {
      if (settleTimeoutRef.current !== null) {
        window.clearTimeout(settleTimeoutRef.current);
      }
      settleTimeoutRef.current = window.setTimeout(commit, 160);
      return;
    }
    commit();
  }, [anchorCandidates, isMobile, publishTarget, resolveTarget]);

  useLayoutEffect(() => {
    if (!enabled) {
      setTarget(null);
      setTargetAnchor('');
      setDropdownVisible(false);
      setRect(null);
      setMissing(false);
      return;
    }
    setTarget(null);
    setTargetAnchor('');
    setDropdownVisible(false);
    setRect(null);
    setMissing(false);
    resolvedTargetRef.current = null;
    resolvedAnchorRef.current = '';
    find();
    const timeout = window.setTimeout(
      () => {
        const next = resolveTarget();
        setMissing(
          !next.element && !anchorCandidates.some(anchor => tutorialTargetIsLoading(anchor))
        );
        find();
      },
      anchorCandidates.includes('tutorial-network-confirmed')
        ? CONFIRMED_NETWORK_RETRY_DELAY_MS
        : anchorCandidates.includes('tutorial-process-path-review')
          ? PROCESS_PATH_RETRY_DELAY_MS
          : TARGET_RETRY_DELAY_MS
    );
    const candidateSelector = anchorCandidates
      .map(anchor => `[data-tutorial-anchor="${CSS.escape(anchor)}"]`)
      .join(',');
    const nodeContainsCandidate = (node: Node) =>
      node instanceof HTMLElement &&
      (node.matches(candidateSelector) || Boolean(node.querySelector(candidateSelector)));
    const mutationNeedsTargetResolution = (mutation: MutationRecord) => {
      if (!resolvedTargetRef.current?.isConnected) return true;
      if (mutation.type === 'attributes') {
        return (
          mutation.target === resolvedTargetRef.current ||
          (mutation.target instanceof HTMLElement && mutation.target.matches(candidateSelector))
        );
      }
      return (
        Array.from(mutation.addedNodes).some(nodeContainsCandidate) ||
        Array.from(mutation.removedNodes).some(
          node =>
            node === resolvedTargetRef.current ||
            (node instanceof HTMLElement && node.contains(resolvedTargetRef.current))
        )
      );
    };
    const observer = new MutationObserver(mutations => {
      if (
        mutations.some(mutationNeedsTargetResolution) ||
        SPOTLIGHT_DROPDOWN_ANCHORS.has(resolvedAnchorRef.current)
      ) {
        find();
      }
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-tutorial-anchor'],
      childList: true,
      subtree: true,
    });
    return () => {
      window.clearTimeout(timeout);
      if (settleTimeoutRef.current !== null) {
        window.clearTimeout(settleTimeoutRef.current);
        settleTimeoutRef.current = null;
      }
      if (publishFrameRef.current !== null) {
        window.cancelAnimationFrame(publishFrameRef.current);
        publishFrameRef.current = null;
      }
      observer.disconnect();
    };
  }, [anchorCandidates, enabled, find, isMobile, resolveTarget, retryVersion, routeKey]);

  useEffect(() => {
    if (!target) return;
    const update = () => {
      centerMobileTutorialTarget(target, targetAnchor, isMobile);
      setDropdownVisible(visibleTutorialDropdownsFor(target, targetAnchor).length > 0);
      const nextRect = tutorialSpotlightRectFor(target, targetAnchor);
      setRect(current => (spotlightRectsAreEqual(current, nextRect) ? current : nextRect));
    };
    let animationFrame: number | null = null;
    let remainingAnimationFrames = SPOTLIGHT_ANIMATION_TRACKING_FRAMES;
    const trackAnimation = () => {
      update();
      remainingAnimationFrames -= 1;
      if (remainingAnimationFrames > 0) {
        animationFrame = window.requestAnimationFrame(trackAnimation);
      }
    };
    const observer = new ResizeObserver(update);
    const mobileScrollerSelector = mobileHorizontalScrollerSelector(targetAnchor);
    const mobileHorizontalScroller =
      isMobile && mobileScrollerSelector
        ? target.closest<HTMLElement>(mobileScrollerSelector)
        : null;
    const visualViewport = isMobile ? window.visualViewport : null;
    observer.observe(target);
    if (mobileHorizontalScroller && mobileHorizontalScroller !== target) {
      observer.observe(mobileHorizontalScroller);
    }
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    visualViewport?.addEventListener('resize', update);
    visualViewport?.addEventListener('scroll', update);
    if (SPOTLIGHT_ANIMATED_ANCHORS.has(targetAnchor)) {
      animationFrame = window.requestAnimationFrame(trackAnimation);
    }
    return () => {
      observer.disconnect();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      visualViewport?.removeEventListener('resize', update);
      visualViewport?.removeEventListener('scroll', update);
    };
  }, [isMobile, target, targetAnchor]);

  return {
    target,
    targetAnchor,
    dropdownVisible,
    rect,
    missing,
    retry: () => setRetryVersion(value => value + 1),
  };
}

export function AppTutorialOrchestrator() {
  const navigate = useNavigate();
  const location = useRouterState({
    select: state => ({
      pathname: state.location.pathname,
      href: state.location.href,
    }),
  });
  const pathname = location.pathname;
  const href = location.href;
  const { language, t } = useTranslation();
  const isMobileScreen = useScreenStore(state => state.isMobileScreen);
  const text = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(tutorialLabelKeys).map(([name, key]) => [name, t(key)])
      ) as Record<keyof typeof tutorialLabelKeys, string>,
    [t]
  );
  const [run, setRun] = useState<PublicAppTutorialRun | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCheckpointText, setCopiedCheckpointText] = useState<string | null>(null);
  const [pendingEffectCheckpointId, setPendingEffectCheckpointId] = useState<string | null>(null);
  const [osmLoadFailed, setOsmLoadFailed] = useState(false);
  const [spotlightAnchorOverride, setSpotlightAnchorOverride] = useState<string | null>(null);
  const [mobileDetailsState, setMobileDetailsState] = useState<{
    checkpointId: AppTutorialCheckpointId;
    open: boolean;
  } | null>(null);
  const [mobileCollapsedState, setMobileCollapsedState] = useState<{
    checkpointId: AppTutorialCheckpointId;
    collapsed: boolean;
  } | null>(null);
  const advancingRef = useRef(false);
  const advanceRequestRef = useRef<{
    promise: Promise<TutorialMoveResult>;
  } | null>(null);

  const checkpoint = useMemo(
    () => (run ? getAppTutorialCheckpoint(run.currentCheckpointId) : null),
    [run]
  );
  const waitingForSimulation = pendingEffectCheckpointId === checkpoint?.id;
  const mobileDetailsOpen = checkpoint
    ? mobileDetailsState?.checkpointId === checkpoint.id
      ? mobileDetailsState.open
      : mobileDetailsOpenByDefault(checkpoint.completion)
    : false;
  const enabled =
    Boolean(run && checkpoint && run.status === 'active') && pathname !== '/onboarding';
  const spotlightAnchors = useMemo<readonly string[]>(() => {
    if (spotlightAnchorOverride) return [spotlightAnchorOverride];
    if (!checkpoint) return [''];
    return (
      CHECKPOINT_SPOTLIGHT_ANCHORS[checkpoint.id] ?? [
        checkpoint.spotlightAnchor ?? checkpoint.anchor,
      ]
    );
  }, [checkpoint, spotlightAnchorOverride]);
  const { target, targetAnchor, dropdownVisible, rect, missing, retry } = useSpotlightTarget(
    spotlightAnchors,
    enabled,
    href,
    isMobileScreen
  );

  useEffect(() => {
    if (!checkpoint || !target || !enabled) return;
    target.setAttribute(CURRENT_TUTORIAL_TARGET_ATTRIBUTE, checkpoint.id);
    return () => {
      if (target.getAttribute(CURRENT_TUTORIAL_TARGET_ATTRIBUTE) === checkpoint.id) {
        target.removeAttribute(CURRENT_TUTORIAL_TARGET_ATTRIBUTE);
      }
    };
  }, [checkpoint?.id, enabled, target]);

  useEffect(() => {
    if (!checkpoint) return;
    setMobileDetailsState({
      checkpointId: checkpoint.id,
      open: mobileDetailsOpenByDefault(checkpoint.completion),
    });
  }, [checkpoint]);

  useEffect(() => {
    if (!checkpoint) return;
    setMobileCollapsedState({
      checkpointId: checkpoint.id,
      collapsed: false,
    });
  }, [checkpoint?.id]);

  useEffect(() => {
    if (
      !isMobileScreen ||
      !checkpoint ||
      !(
        (checkpoint.id === 'link-climate-council' &&
          targetAnchor === 'network-group-search' &&
          dropdownVisible) ||
        (checkpoint.id === 'accept-change-request' &&
          targetAnchor === 'tutorial-change-request-accept')
      )
    ) {
      return;
    }

    setMobileCollapsedState(current =>
      current?.checkpointId === checkpoint.id && current.collapsed
        ? current
        : { checkpointId: checkpoint.id, collapsed: true }
    );
  }, [checkpoint?.id, dropdownVisible, isMobileScreen, targetAnchor]);

  useEffect(() => {
    if (!enabled) return;
    document.body.setAttribute(APP_TUTORIAL_ACTIVE_BODY_ATTRIBUTE, '');
    return () => document.body.removeAttribute(APP_TUTORIAL_ACTIVE_BODY_ATTRIBUTE);
  }, [enabled]);

  useEffect(() => {
    let active = true;
    void loadTutorialRun()
      .then(result => {
        if (active) setRun(result.run);
      })
      .catch(loadError => {
        console.error('Tutorial state load failed:', loadError);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const moveTo = useCallback(
    async (
      checkpointId: AppTutorialCheckpointId,
      evidence: Parameters<typeof advanceTutorial>[2]
    ): Promise<TutorialMoveResult> => {
      const activeRequest = advanceRequestRef.current;
      if (activeRequest) return activeRequest.promise;

      const activeRun = run as PublicAppTutorialRun;
      advancingRef.current = true;
      setAdvancing(true);
      setError(null);

      const promise = (async (): Promise<TutorialMoveResult> => {
        try {
          const result = await advanceTutorial(activeRun.revision, checkpointId, evidence);
          if (result.pending) return 'pending';
          if (result.completed) {
            setRun(null);
            await navigate(tutorialNavigationOptions('/home'));
            return 'advanced';
          }
          const nextRun = result.run as PublicAppTutorialRun;
          if (!tutorialRouteMatches(href, result.route)) {
            await navigate(tutorialNavigationOptions(result.route));
          }
          // Keep the current checkpoint active until the destination route
          // and its loaders have settled. Otherwise the next target's retry
          // timer starts on the page we are leaving.
          setRun(nextRun);
          return 'advanced';
        } catch (advanceError) {
          const message = localizeAppError(advanceError);
          setError(message);
          if (message.toLowerCase().includes('conflict')) {
            const refreshed = await loadTutorialRun();
            setRun(refreshed.run);
          }
          return 'failed';
        } finally {
          advanceRequestRef.current = null;
          advancingRef.current = false;
          setAdvancing(false);
        }
      })();
      advanceRequestRef.current = { promise };
      return promise;
    },
    [href, navigate, run, text.conflict]
  );

  useEffect(() => {
    if (pendingEffectCheckpointId && pendingEffectCheckpointId !== checkpoint?.id) {
      setPendingEffectCheckpointId(null);
    }
  }, [checkpoint?.id, pendingEffectCheckpointId]);

  useEffect(() => {
    setCopiedCheckpointText(null);
    setOsmLoadFailed(false);
    setSpotlightAnchorOverride(null);
  }, [checkpoint?.id]);

  useEffect(() => {
    if (!checkpoint || !enabled || checkpoint.id !== 'ask-assistant-for-todo') return;
    const onSpotlightTarget = (
      event: WindowEventMap[typeof APP_TUTORIAL_SPOTLIGHT_TARGET_EVENT]
    ) => {
      setSpotlightAnchorOverride(event.detail.anchor);
    };
    window.addEventListener(APP_TUTORIAL_SPOTLIGHT_TARGET_EVENT, onSpotlightTarget);
    return () => window.removeEventListener(APP_TUTORIAL_SPOTLIGHT_TARGET_EVENT, onSpotlightTarget);
  }, [checkpoint, enabled]);

  useEffect(() => {
    if (!checkpoint || !target || !enabled || !waitingForSimulation) return;
    let active = true;
    let timeout: number;

    const attempt = async () => {
      const result = await moveTo(checkpoint.id, {
        type: 'view',
        anchor: checkpoint.anchor,
      });
      if (active && result === 'pending') {
        timeout = window.setTimeout(() => void attempt(), 650);
      }
    };

    timeout = window.setTimeout(() => void attempt(), 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [checkpoint, enabled, moveTo, target, waitingForSimulation]);

  useEffect(() => {
    if (!checkpoint || !target || !enabled) return;
    const completion = checkpoint.completion;

    if (completion.type === 'click') {
      const onClick = (event: MouseEvent) => {
        if (event.target === target || target.contains(event.target as Node)) {
          window.setTimeout(() => {
            void moveTo(checkpoint.id, {
              type: 'click',
              anchor: checkpoint.anchor,
            });
          });
        }
      };
      window.addEventListener('click', onClick, true);
      return () => window.removeEventListener('click', onClick, true);
    }

    if (completion.type === 'input') {
      const onInput = (event: Event) => {
        if (
          event.target instanceof HTMLInputElement &&
          matchesCompletionInput(event.target.value, completion) &&
          checkpoint.id === 'search-initiative'
        ) {
          // Search proceeds when its result becomes available. Message sending
          // reports the same evidence explicitly after the send succeeds.
          void moveTo(checkpoint.id, {
            type: 'input',
            value: event.target.value,
          });
        }
      };
      target.addEventListener('input', onInput);
      return () => target.removeEventListener('input', onInput);
    }

    if (completion.type !== 'horizontal-scroll') return;

    const scrollTarget = horizontalScrollerFor(target);
    const isDesktopHorizontalScroll = window.matchMedia('(min-width: 768px)').matches;
    let previousScrollLeft = scrollTarget.scrollLeft;
    let accumulatedScrollPixels = 0;
    let swipe:
      | {
          pointerId: number;
          startX: number;
          startY: number;
        }
      | undefined;

    const scrollRangePixels = () =>
      Math.max(0, scrollTarget.scrollWidth - scrollTarget.clientWidth);
    const completeHorizontalScroll = (scrollPixels: number) => {
      const range = scrollRangePixels();
      const requiredPixels =
        range > 0 ? Math.min(completion.minimumPixels, range) : completion.minimumPixels;
      if (scrollPixels < requiredPixels) return;
      void moveTo(checkpoint.id, {
        type: 'scroll',
        scrollPixels,
        scrollRangePixels: range,
      });
    };
    const onScroll = () => {
      if (isDesktopHorizontalScroll) return;
      const currentScrollLeft = scrollTarget.scrollLeft;
      accumulatedScrollPixels += Math.abs(currentScrollLeft - previousScrollLeft);
      previousScrollLeft = currentScrollLeft;
      completeHorizontalScroll(accumulatedScrollPixels);
    };
    const completeHorizontalSwipe = (event: PointerEvent) => {
      if (!swipe || swipe.pointerId !== event.pointerId || scrollRangePixels() > 0) return;
      const horizontalPixels = Math.abs(event.clientX - swipe.startX);
      const verticalPixels = Math.abs(event.clientY - swipe.startY);
      if (horizontalPixels >= completion.minimumPixels && horizontalPixels > verticalPixels) {
        completeHorizontalScroll(horizontalPixels);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (isDesktopHorizontalScroll || scrollRangePixels() > 0) return;
      swipe = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };
    };
    const onPointerMove = (event: PointerEvent) => {
      completeHorizontalSwipe(event);
    };
    const onPointerUp = (event: PointerEvent) => {
      completeHorizontalSwipe(event);
      if (swipe?.pointerId === event.pointerId) swipe = undefined;
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (swipe?.pointerId === event.pointerId) swipe = undefined;
    };

    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    target.addEventListener('pointerdown', onPointerDown, { passive: true });
    target.addEventListener('pointermove', onPointerMove, { passive: true });
    target.addEventListener('pointerup', onPointerUp, { passive: true });
    target.addEventListener('pointercancel', onPointerCancel, {
      passive: true,
    });
    return () => {
      scrollTarget.removeEventListener('scroll', onScroll);
      target.removeEventListener('pointerdown', onPointerDown);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerUp);
      target.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [checkpoint, enabled, language, moveTo, target]);

  useEffect(() => {
    if (!checkpoint || !target || !enabled || checkpoint.completion.type !== 'input') return;
    const completion = checkpoint.completion;
    let lastSubmittedValue = '';
    const submitMatchingValue = () => {
      const matchingValue = tutorialInputValuesFor(target).find(value =>
        matchesCompletionInput(value, completion)
      );
      if (!matchingValue || matchingValue === lastSubmittedValue) return;
      lastSubmittedValue = matchingValue;
      void moveTo(checkpoint.id, { type: 'input', value: matchingValue });
    };
    submitMatchingValue();
    const observer = new MutationObserver(submitMatchingValue);
    observer.observe(target, {
      attributes: true,
      attributeFilter: [TUTORIAL_INPUT_VALUES_ATTRIBUTE],
    });
    return () => observer.disconnect();
  }, [checkpoint, enabled, moveTo, target]);

  useEffect(() => {
    if (!checkpoint || !enabled || !VOTING_SELECTION_RECOVERY_ANCHORS.has(checkpoint.anchor)) {
      return;
    }
    const timeout = window.setTimeout(() => {
      requestAppTutorialTargetRecovery(checkpoint.anchor);
    });
    return () => window.clearTimeout(timeout);
  }, [checkpoint, enabled]);

  useEffect(() => {
    if (!checkpoint || !enabled) return;
    const onAction = (event: WindowEventMap[typeof APP_TUTORIAL_ACTION_EVENT]) => {
      const completion = checkpoint.completion;
      const detail = event.detail;
      if (
        checkpoint.id === 'load-city-design-osm' &&
        detail.type === 'action' &&
        detail.event === APP_TUTORIAL_OSM_LOAD_FAILED_ACTION
      ) {
        setOsmLoadFailed(true);
        return;
      }
      const isExpectedAction =
        completion.type === 'action' &&
        detail.type === 'action' &&
        detail.event === completion.event &&
        matchesCompletionActionValue(detail.value ?? '', completion);
      const isExpectedMutation =
        completion.type === 'mutation' &&
        detail.type === 'mutation' &&
        detail.event === completion.event;
      const isExpectedDrop =
        completion.type === 'drop' && detail.type === 'drop' && detail.event === completion.event;
      const isExpectedInput =
        completion.type === 'input' &&
        detail.type === 'input' &&
        matchesCompletionInput(detail.value ?? '', completion);
      const isExpectedEntitySelection =
        completion.type === 'entity-selection' &&
        detail.type === 'entity-selection' &&
        Boolean(detail.entityId);
      if (
        isExpectedAction ||
        isExpectedMutation ||
        isExpectedDrop ||
        isExpectedInput ||
        isExpectedEntitySelection
      ) {
        void moveTo(checkpoint.id, detail);
      }
    };
    window.addEventListener(APP_TUTORIAL_ACTION_EVENT, onAction);
    return () => window.removeEventListener(APP_TUTORIAL_ACTION_EVENT, onAction);
  }, [checkpoint, enabled, language, moveTo]);

  useEffect(() => {
    if (!loaded || !run || run.status !== 'active' || advancingRef.current) return;
    if (pathname === '/onboarding' || tutorialRouteMatches(href, run.route)) return;
    const timeout = window.setTimeout(() => {
      if (!advancingRef.current) {
        void navigate(tutorialNavigationOptions(run.route));
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [href, loaded, navigate, pathname, run]);

  useEffect(() => {
    if (!enabled || !target) return;
    const allowedDropdowns = visibleTutorialDropdownsFor(target, targetAnchor);
    const containsAllowedDropdown = (element: HTMLElement) =>
      allowedDropdowns.some(dropdown => element === dropdown || element.contains(dropdown));
    const belongsToAllowedDropdown = (element: HTMLElement) =>
      allowedDropdowns.some(dropdown => element === dropdown || dropdown.contains(element));
    const inerted: [HTMLElement, boolean][] = [];
    let child: HTMLElement = target;
    let parent = child.parentElement;
    while (parent && parent !== document.body) {
      for (const sibling of Array.from(parent.children)) {
        if (!(sibling instanceof HTMLElement) || sibling === child) continue;
        if (
          sibling.matches('[data-testid="app-tutorial-spotlight"]') ||
          sibling.querySelector('[data-testid="app-tutorial-spotlight"]') ||
          sibling.matches('[data-tutorial-overlay-allowed]') ||
          sibling.querySelector('[data-tutorial-overlay-allowed]') ||
          containsAllowedDropdown(sibling)
        ) {
          continue;
        }
        inerted.push([sibling, sibling.inert]);
        sibling.inert = true;
      }
      child = parent;
      parent = parent.parentElement;
    }

    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>('a[href],button,input,textarea,select,[tabindex]')
    ).filter(
      element =>
        !target.contains(element) &&
        element !== target &&
        !belongsToAllowedDropdown(element) &&
        !element.closest('[data-tutorial-overlay-allowed]') &&
        !element.closest('[data-testid="app-tutorial-spotlight"]')
    );
    const prior = focusable.map(element => [element, element.getAttribute('tabindex')] as const);
    for (const element of focusable) element.setAttribute('tabindex', '-1');
    return () => {
      for (const [element, priorInert] of inerted) element.inert = priorInert;
      for (const [element, tabindex] of prior) {
        if (tabindex === null) element.removeAttribute('tabindex');
        else element.setAttribute('tabindex', tabindex);
      }
    };
  }, [dropdownVisible, enabled, target, targetAnchor]);

  const leave = async () => {
    const activeRun = run as PublicAppTutorialRun;
    setAdvancing(true);
    try {
      const result = await pauseTutorial(activeRun.revision);
      setRun(result.run);
    } finally {
      setAdvancing(false);
    }
  };

  const restart = async () => {
    setAdvancing(true);
    setError(null);
    try {
      const result = await restartTutorial();
      setRun(result.run);
      await navigate(tutorialNavigationOptions(result.run.route));
    } catch (restartError) {
      setError(localizeAppError(restartError));
    } finally {
      setAdvancing(false);
    }
  };

  const retryTarget = () => {
    retry();
    const activeCheckpoint = checkpoint as NonNullable<typeof checkpoint>;
    if (RECOVERABLE_VOTING_ANCHORS.has(activeCheckpoint.anchor)) {
      requestAppTutorialTargetRecovery(activeCheckpoint.anchor);
      return;
    }
    window.location.assign((run as PublicAppTutorialRun).route);
  };

  const copyCheckpointText = async (copyText: string) => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopiedCheckpointText(copyText);
      setError(null);
    } catch {
      setError(text.copyFailed);
    }
  };

  const confirmCurrentCheckpoint = async () => {
    const activeCheckpoint = checkpoint as NonNullable<typeof checkpoint>;
    const result = await moveTo(
      activeCheckpoint.id,
      activeCheckpoint.completion.type === 'view'
        ? {
            type: 'view',
            anchor: activeCheckpoint.anchor,
          }
        : {
            type: 'acknowledge',
            desktopAcknowledged: activeCheckpoint.completion.type === 'horizontal-scroll',
          }
    );
    if (result === 'advanced' && activeCheckpoint.id === 'view-network-pending') {
      requestAppTutorialNetworkApproval();
    }
    if (result === 'pending') {
      setPendingEffectCheckpointId(activeCheckpoint.id);
    }
  };

  const triggerCardAction = async () => {
    const activeCheckpoint = checkpoint as NonNullable<typeof checkpoint>;
    await moveTo(activeCheckpoint.id, {
      type: 'click',
      anchor: activeCheckpoint.anchor,
    });
  };

  const retryOsmLoading = () => {
    setOsmLoadFailed(false);
    target?.click();
  };

  if (!enabled || !checkpoint || typeof document === 'undefined') return null;

  const acknowledge =
    !waitingForSimulation &&
    (checkpoint.completion.type === 'acknowledge' ||
      checkpoint.completion.type === 'view' ||
      (checkpoint.completion.type === 'horizontal-scroll' &&
        window.matchMedia('(min-width: 768px)').matches));
  const waitingMessage =
    waitingForSimulation && checkpoint.effect === 'accept-membership'
      ? text.waitingForMembership
      : waitingForSimulation && checkpoint.effect === 'confirm-network-rights'
        ? text.waitingForNetwork
        : null;
  const loadingConfirmedNetwork = checkpoint.id === 'view-network-confirmed' && !rect && !missing;
  const loadingAmendment = checkpoint.id === 'edit-amendment-text' && !rect && !missing;
  const mobileCollapsed =
    isMobileScreen && mobileCollapsedState?.checkpointId === checkpoint.id
      ? mobileCollapsedState.collapsed
      : false;
  const checkpointCopyTexts = (
    checkpoint.copyTexts ?? (checkpoint.copyText ? [checkpoint.copyText] : [])
  ).map(copyText => localizeAppTutorialExpectedInput(copyText, language));
  const multipleCheckpointCopyTexts = checkpointCopyTexts.length > 1;

  return createPortal(
    <div
      data-testid="app-tutorial-spotlight"
      data-tutorial-checkpoint={checkpoint.id}
      data-tutorial-route={run?.route}
    >
      {rect && <SpotlightSurfaces rect={rect} />}
      {rect && <SpotlightTargetOutline rect={rect} />}
      {rect && (
        <TutorialCoachCard
          rect={rect}
          checkpointId={checkpoint.id}
          isMobile={isMobileScreen}
          collapsed={mobileCollapsed}
        >
          <CardContent
            className={cn(
              'max-w-full min-w-0 space-y-4 p-5',
              isMobileScreen && 'space-y-3 overflow-x-hidden p-4',
              mobileCollapsed && 'h-full space-y-0 p-2'
            )}
          >
            <Collapsible
              className={cn(
                isMobileScreen && 'max-w-full min-w-0 overflow-x-hidden',
                mobileCollapsed && 'h-full'
              )}
              open={!isMobileScreen || mobileDetailsOpen}
              onOpenChange={
                isMobileScreen
                  ? open => setMobileDetailsState({ checkpointId: checkpoint.id, open })
                  : undefined
              }
            >
              <div
                className={cn(
                  isMobileScreen
                    ? 'grid max-w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3'
                    : 'block',
                  mobileCollapsed && 'h-full items-center'
                )}
              >
                <div className={cn('min-w-0 flex-1', mobileCollapsed && 'flex items-center gap-2')}>
                  <p
                    className={cn(
                      'text-muted-foreground text-xs font-medium',
                      mobileCollapsed && 'shrink-0'
                    )}
                  >
                    {checkpoint.chapter}/13
                  </p>
                  <h2
                    id="app-tutorial-title"
                    className={cn(
                      'mt-1 text-lg font-semibold',
                      mobileCollapsed && 'mt-0 truncate text-sm'
                    )}
                  >
                    {localizeAppTutorialText(checkpoint.copy[language].title, language)}
                  </h2>
                </div>
                {isMobileScreen && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      data-action-id="app-tutorial.coach.instruction.toggle"
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground h-8 w-8 shrink-0 p-0"
                      aria-label={mobileCollapsed ? text.showInstruction : text.minimizeInstruction}
                      aria-expanded={!mobileCollapsed}
                      aria-controls="app-tutorial-expanded-instruction"
                      title={mobileCollapsed ? text.showInstruction : text.minimizeInstruction}
                      onClick={() =>
                        setMobileCollapsedState({
                          checkpointId: checkpoint.id,
                          collapsed: !mobileCollapsed,
                        })
                      }
                    >
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform',
                          !mobileCollapsed && 'rotate-180'
                        )}
                      />
                    </Button>
                    {!mobileCollapsed && (
                      <CollapsibleTrigger asChild>
                        <Button
                          data-action-id="app-tutorial.coach.details.toggle"
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground h-8 shrink-0 gap-1 px-2 text-xs"
                        >
                          {mobileDetailsOpen ? text.hideDetails : text.showDetails}
                          <ChevronDown
                            className={cn(
                              'h-3.5 w-3.5 transition-transform',
                              mobileDetailsOpen && 'rotate-180'
                            )}
                          />
                        </Button>
                      </CollapsibleTrigger>
                    )}
                  </div>
                )}
              </div>
              <div
                id="app-tutorial-expanded-instruction"
                hidden={mobileCollapsed}
                className="max-w-full min-w-0 space-y-3"
              >
                <CollapsibleContent
                  className={cn(
                    isMobileScreen &&
                      'mt-2 max-h-[30dvh] [scrollbar-gutter:stable] overflow-y-auto pr-1'
                  )}
                >
                  <p className="text-muted-foreground mt-2 min-w-0 text-sm leading-6 [overflow-wrap:anywhere] break-words">
                    {localizeAppTutorialText(checkpoint.copy[language].body, language)}
                  </p>
                </CollapsibleContent>
                <div
                  className={cn(
                    'border-primary/30 bg-primary/10 text-primary items-start gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold',
                    isMobileScreen || multipleCheckpointCopyTexts
                      ? cn('grid grid-cols-[auto_minmax(0,1fr)]', !isMobileScreen && 'mt-4')
                      : 'mt-4 flex flex-wrap'
                  )}
                >
                  <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="min-w-0 flex-1 [overflow-wrap:anywhere] break-words">
                    {localizeAppTutorialText(checkpoint.copy[language].instruction, language)}
                  </p>
                  {checkpointCopyTexts.length > 0 && (
                    <div
                      className={cn(
                        'flex flex-wrap gap-2',
                        (isMobileScreen || multipleCheckpointCopyTexts) &&
                          'col-start-2 justify-self-start'
                      )}
                    >
                      {checkpointCopyTexts.map(copyText => {
                        const copied = copiedCheckpointText === copyText;
                        const showValue = checkpointCopyTexts.length > 1;
                        return (
                          <Button
                            data-action-id="app-tutorial.coach.checkpoint-copy.copy"
                            key={copyText}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="bg-background/80 text-foreground h-7 shrink-0 gap-1.5 px-2 text-xs"
                            aria-label={`${text.copy}: ${copyText}`}
                            onClick={() => void copyCheckpointText(copyText)}
                          >
                            {copied ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            {showValue
                              ? `${copyText} · ${copied ? text.copied : text.copy}`
                              : copied
                                ? text.copied
                                : text.copy}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {isMobileScreen && checkpoint.id === 'primary-navigation' && (
                  <p className="border-border bg-muted/40 text-muted-foreground rounded-md border px-3 py-2 text-xs leading-5 [overflow-wrap:anywhere] break-words">
                    {text.mobileDesktopHint}
                  </p>
                )}
                {waitingMessage && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="border-border bg-muted/40 space-y-2.5 rounded-md border px-3 py-3"
                  >
                    <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs font-medium">
                      <LoaderCircle className="text-primary h-4 w-4 shrink-0 animate-spin" />
                      <p className="min-w-0 [overflow-wrap:anywhere] break-words">
                        {waitingMessage}
                      </p>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={waitingMessage}
                      className="bg-secondary h-1.5 w-full overflow-hidden rounded-full"
                    >
                      <div className="bg-primary h-full w-1/2 animate-pulse rounded-full" />
                    </div>
                  </div>
                )}
                {checkpoint.id === 'load-city-design-osm' && osmLoadFailed && (
                  <div
                    role="alert"
                    className="border-destructive/30 bg-destructive/10 space-y-2 rounded-md border px-3 py-3"
                  >
                    <p className="text-destructive flex min-w-0 items-start gap-2 text-xs font-medium [overflow-wrap:anywhere] break-words">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {text.osmLoadFailed}
                    </p>
                    <Button
                      data-action-id="app-tutorial.coach.osm.retry"
                      type="button"
                      size="sm"
                      disabled={advancing}
                      onClick={retryOsmLoading}
                    >
                      <RotateCw className="h-4 w-4" />
                      {text.retryOsm}
                    </Button>
                  </div>
                )}
                {error && (
                  <p className="text-destructive flex min-w-0 items-start gap-2 text-xs [overflow-wrap:anywhere] break-words">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {checkpoint.cardAction && checkpoint.completion.type === 'click' && (
                    <Button
                      data-action-id="app-tutorial.coach.card-action.execute"
                      type="button"
                      className="shadow-sm"
                      data-tutorial-anchor={checkpoint.anchor}
                      disabled={advancing}
                      loading={advancing}
                      loadingLabel={checkpoint.cardAction[language]}
                      onClick={() => void triggerCardAction()}
                    >
                      <MousePointerClick className="h-4 w-4" />
                      {checkpoint.cardAction[language]}
                    </Button>
                  )}
                  {acknowledge && (
                    <Button
                      data-action-id="app-tutorial.coach.checkpoint.confirm"
                      type="button"
                      className="shadow-sm"
                      data-testid="app-tutorial-continue"
                      disabled={advancing}
                      loading={advancing}
                      loadingLabel={
                        checkpoint.completion.type === 'acknowledge'
                          ? text.understand
                          : text.continue
                      }
                      onClick={() => void confirmCurrentCheckpoint()}
                    >
                      <Check className="h-4 w-4" />
                      {checkpoint.completion.type === 'acknowledge'
                        ? text.understand
                        : text.continue}
                    </Button>
                  )}
                  <Button
                    data-action-id="app-tutorial.coach.leave"
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground ml-auto h-8 px-2 text-xs font-normal opacity-70 hover:opacity-100"
                    disabled={advancing}
                    onClick={() => void leave()}
                  >
                    {text.leave}
                  </Button>
                </div>
              </div>
            </Collapsible>
          </CardContent>
        </TutorialCoachCard>
      )}
      {missing && (
        <div className="fixed inset-0 z-[2147483200] grid place-items-center bg-black/60 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="space-y-4 p-6">
              <AlertTriangle className="text-destructive h-7 w-7" />
              <div>
                <h2 className="font-semibold">{text.missingTitle}</h2>
                <p className="text-muted-foreground mt-2 text-sm">{text.missingBody}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  data-action-id="app-tutorial.missing-target.retry"
                  size="sm"
                  onClick={retryTarget}
                >
                  <RotateCw className="h-4 w-4" />
                  {text.retry}
                </Button>
                <Button
                  data-action-id="app-tutorial.missing-target.leave"
                  size="sm"
                  variant="outline"
                  onClick={() => void leave()}
                >
                  {text.leave}
                </Button>
                <Button
                  data-action-id="app-tutorial.missing-target.restart"
                  size="sm"
                  variant="ghost"
                  className={cn('text-destructive')}
                  onClick={() => void restart()}
                >
                  {text.restart}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {(loadingConfirmedNetwork || loadingAmendment) && (
        <div className="fixed inset-0 z-[2147483150] grid place-items-center bg-black/60 p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="space-y-3 p-5">
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <LoaderCircle className="text-primary h-4 w-4 shrink-0 animate-spin" />
                <p>{loadingAmendment ? text.loadingAmendment : text.loadingConfirmedNetwork}</p>
              </div>
              <div
                role="progressbar"
                aria-label={loadingAmendment ? text.loadingAmendment : text.loadingConfirmedNetwork}
                className="bg-secondary h-1.5 w-full overflow-hidden rounded-full"
              >
                <div className="bg-primary h-full w-1/2 animate-pulse rounded-full" />
              </div>
              <div className="flex justify-end">
                <Button
                  data-action-id="app-tutorial.loading.leave"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground h-8 px-2 text-xs font-normal opacity-70"
                  disabled={advancing}
                  onClick={() => void leave()}
                >
                  {text.leave}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>,
    document.body
  );
}

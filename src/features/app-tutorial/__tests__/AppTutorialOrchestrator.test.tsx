/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AppTutorialOrchestrator,
  mobileDetailsOpenByDefault,
  tutorialInputValuesFor,
  tutorialCardStyle,
  tutorialSpotlightRectFor,
  visibleTutorialTarget,
} from '../AppTutorialOrchestrator';
import { useScreenStore } from '@/features/shared/global-state/screen.store';
import {
  APP_TUTORIAL_ACCEPT_NETWORK_EVENT,
  APP_TUTORIAL_ACTION_EVENT,
  APP_TUTORIAL_OSM_LOAD_FAILED_ACTION,
  APP_TUTORIAL_RECOVER_TARGET_EVENT,
  reportAppTutorialAction,
  requestAppTutorialSpotlightTarget,
} from '../events';

const mocks = vi.hoisted(() => ({
  advanceTutorial: vi.fn(),
  loadTutorialRun: vi.fn(),
  navigate: vi.fn(),
  resizeObserve: vi.fn(),
  writeClipboard: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({
      location: {
        pathname: '/group/group-1/network',
        href: '/group/group-1/network?tab=manage-network',
      },
    }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (key: string) =>
      ({
        'features.appTutorial.orchestrator.understand': 'Got it',
        'features.appTutorial.orchestrator.continue': 'Continue',
        'features.appTutorial.orchestrator.leave': 'Leave tutorial',
        'features.appTutorial.orchestrator.restart': 'Restart',
        'features.appTutorial.orchestrator.retry': 'Try again',
        'features.appTutorial.orchestrator.missingTitle': 'This target is not available right now',
        'features.appTutorial.orchestrator.missingBody':
          'The page or its sandbox data could not be restored completely.',
        'features.appTutorial.orchestrator.conflict': 'The tutorial was updated in another tab.',
        'features.appTutorial.orchestrator.waitingForMembership':
          'Waiting for the initiative to accept your membership request …',
        'features.appTutorial.orchestrator.waitingForNetwork':
          'Waiting for the other group to accept the request …',
        'features.appTutorial.orchestrator.loadingConfirmedNetwork': 'Loading the accepted link …',
        'features.appTutorial.orchestrator.copy': 'Copy',
        'features.appTutorial.orchestrator.copied': 'Copied',
        'features.appTutorial.orchestrator.copyFailed':
          'The text could not be copied to the clipboard.',
        'features.appTutorial.orchestrator.showDetails': 'Show details',
        'features.appTutorial.orchestrator.hideDetails': 'Hide details',
        'features.appTutorial.orchestrator.minimizeInstruction': 'Minimize instruction',
        'features.appTutorial.orchestrator.showInstruction': 'Show instruction',
        'features.appTutorial.orchestrator.mobileDesktopHint':
          'This tutorial is optimized for desktop. On mobile, you may need to collapse the tutorial instructions, perform an action, and expand them again afterward.',
        'features.appTutorial.orchestrator.osmLoadFailed': 'The OSM data could not be loaded.',
        'features.appTutorial.orchestrator.retryOsm': 'Retry OSM loading',
      })[key] ?? key,
  }),
}));

vi.mock('../api', () => ({
  advanceTutorial: mocks.advanceTutorial,
  loadTutorialRun: mocks.loadTutorialRun,
  pauseTutorial: vi.fn(),
  restartTutorial: vi.fn(),
}));

beforeEach(() => {
  useScreenStore.setState({ isMobileScreen: false });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    bottom: 160,
    height: 60,
    left: 20,
    right: 320,
    top: 100,
    width: 300,
    x: 20,
    y: 100,
    toJSON: () => undefined,
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(element: Element) {
        mocks.resizeObserve(element);
        return undefined;
      }
      disconnect() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
    }
  );
  vi.stubGlobal('CSS', {
    ...globalThis.CSS,
    escape: (value: string) => value,
  });
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    })
  );
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: mocks.writeClipboard,
    },
  });
  mocks.writeClipboard.mockResolvedValue(undefined);
  mocks.navigate.mockResolvedValue(undefined);
  mocks.loadTutorialRun.mockResolvedValue({
    run: {
      runId: 'run-1',
      status: 'active',
      currentCheckpointId: 'view-network-pending',
      route: '/group/group-1/network?tab=manage-network',
      revision: 4,
      expiresAt: '2026-08-25T00:00:00.000Z',
    },
  });
  mocks.advanceTutorial.mockResolvedValue({
    completed: false,
    pending: true,
    route: '/group/group-1/network?tab=manage-network',
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('AppTutorialOrchestrator', () => {
  it('uses compact defaults for actions and expanded defaults for explanatory steps', () => {
    expect(mobileDetailsOpenByDefault({ type: 'click' })).toBe(false);
    expect(mobileDetailsOpenByDefault({ type: 'input', expected: 'groupSearch' })).toBe(false);
    expect(mobileDetailsOpenByDefault({ type: 'acknowledge' })).toBe(true);
    expect(mobileDetailsOpenByDefault({ type: 'view' })).toBe(true);
  });

  it('renders the open-network action inside the coach card and advances from there', async () => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'open-network',
        route: '/todos/todo-1',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });
    mocks.advanceTutorial.mockResolvedValueOnce({
      completed: false,
      pending: false,
      route: '/group/group-1/network?tab=current-network',
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'manage-network',
        route: '/group/group-1/network?tab=current-network',
        revision: 3,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <div data-tutorial-anchor="todo-complete">Tutorial todo</div>
        <AppTutorialOrchestrator />
      </>
    );

    const action = await screen.findByRole('button', { name: 'Network' });
    const card = screen.getByTestId('app-tutorial-coach-card');

    expect(card.contains(action)).toBe(true);
    expect(
      document.querySelectorAll('[data-tutorial-anchor="tutorial-open-network"]')
    ).toHaveLength(1);

    fireEvent.click(action);

    await waitFor(() =>
      expect(mocks.advanceTutorial).toHaveBeenCalledWith(2, 'open-network', {
        type: 'click',
        anchor: 'tutorial-open-network',
      })
    );
    expect(mocks.advanceTutorial).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/group/group-1/network?tab=current-network',
        replace: true,
      })
    );
  });

  it('positions the mobile card by spotlight thirds and measures the primary navigation', () => {
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('innerWidth', 400);
    const navigation = document.createElement('nav');
    navigation.dataset.navigationType = 'primary';
    navigation.getBoundingClientRect = vi.fn().mockReturnValue({
      bottom: 800,
      height: 80,
      left: 0,
      right: 400,
      top: 720,
      width: 400,
    });
    document.body.append(navigation);

    expect(
      tutorialCardStyle(
        {
          top: 40,
          bottom: 100,
          left: 20,
          right: 320,
          width: 300,
          height: 60,
        },
        undefined,
        true
      )
    ).toMatchObject({
      bottom: 92,
      maxHeight: 'min(50dvh, 24rem)',
    });
    expect(
      tutorialCardStyle(
        {
          top: 370,
          bottom: 430,
          left: 20,
          right: 320,
          width: 300,
          height: 60,
        },
        undefined,
        true
      )
    ).toMatchObject({
      bottom: 92,
      maxHeight: 'min(50dvh, 24rem)',
    });
    expect(
      tutorialCardStyle(
        {
          top: 650,
          bottom: 710,
          left: 20,
          right: 320,
          width: 300,
          height: 60,
        },
        undefined,
        true
      )
    ).toMatchObject({
      top: 'calc(12px + env(safe-area-inset-top))',
      maxHeight: 'min(50dvh, 24rem)',
    });
    expect(
      tutorialCardStyle(
        {
          top: 40,
          bottom: 100,
          left: 20,
          right: 320,
          width: 300,
          height: 60,
        },
        undefined,
        true,
        true
      )
    ).toMatchObject({
      bottom: 92,
      height: 80,
      maxHeight: 80,
    });

    vi.mocked(navigation.getBoundingClientRect).mockReturnValue({
      bottom: 800,
      height: 64,
      left: 0,
      right: 400,
      top: 736,
      width: 400,
    } as DOMRect);
    expect(
      tutorialCardStyle(
        {
          top: 40,
          bottom: 100,
          left: 20,
          right: 320,
          width: 300,
          height: 60,
        },
        undefined,
        true,
        true
      )
    ).toMatchObject({
      bottom: 76,
      height: 64,
      maxHeight: 64,
    });

    navigation.remove();
    expect(
      tutorialCardStyle(
        {
          top: 40,
          bottom: 100,
          left: 20,
          right: 320,
          width: 300,
          height: 60,
        },
        undefined,
        true,
        true
      )
    ).toMatchObject({
      bottom: 'calc(88px + env(safe-area-inset-bottom))',
      height: 76,
      maxHeight: 76,
    });

    vi.stubGlobal('visualViewport', {
      offsetLeft: 20,
      width: 360,
    });
    expect(
      tutorialCardStyle(
        {
          top: 40,
          bottom: 100,
          left: 20,
          right: 320,
          width: 300,
          height: 60,
        },
        undefined,
        true
      )
    ).toMatchObject({
      left: 32,
      width: 336,
    });
  });

  it('keeps the mobile coach global and switches from the link trigger to group search', async () => {
    useScreenStore.setState({ isMobileScreen: true });
    mocks.advanceTutorial.mockResolvedValueOnce({
      completed: false,
      pending: false,
      route: '/group/group-1/network?tab=manage-network',
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'select-climate-council-child',
        route: '/group/group-1/network?tab=manage-network',
        revision: 3,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'link-climate-council',
        route: '/group/group-1/network?tab=manage-network',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    function LinkTargets() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button data-tutorial-anchor="link-group" onClick={() => setOpen(true)}>
            Link Group
          </button>
          {open ? (
            <div data-slot="dialog-content" role="dialog" aria-label="Link Group dialog">
              <div data-tutorial-anchor="network-group-search">
                <input aria-label="Group search" />
              </div>
              <div data-typeahead-dropdown>
                <button
                  type="button"
                  onClick={() =>
                    reportAppTutorialAction({
                      type: 'entity-selection',
                      entityId: 'climate-council-id',
                    })
                  }
                >
                  Munich Climate Council
                </button>
              </div>
            </div>
          ) : null}
          <button data-tutorial-anchor="network-child-preset">Child preset</button>
        </>
      );
    }

    render(
      <>
        <LinkTargets />
        <AppTutorialOrchestrator />
      </>
    );

    await screen.findByRole('heading', { name: 'Find Munich Climate Council' });
    const root = screen.getByTestId('app-tutorial-spotlight');
    const card = screen.getByTestId('app-tutorial-coach-card');
    const linkTrigger = screen.getByRole('button', { name: 'Link Group' });

    expect(root.contains(card)).toBe(true);
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-modal')).toBe('true');
    expect(card.hasAttribute('data-tutorial-overlay-allowed')).toBe(true);
    expect(card.className).toContain('fixed');
    expect(card.className).toContain('z-[2147483100]');
    expect(
      Array.from(root.querySelectorAll<HTMLElement>('*')).some(element =>
        element.className.includes('z-[2147483000]')
      )
    ).toBe(true);
    expect(linkTrigger.getAttribute('tabindex')).not.toBe('-1');

    fireEvent.click(linkTrigger);

    const groupSearch = await screen.findByRole('textbox', { name: 'Group search' });
    await waitFor(() => expect(groupSearch.getAttribute('tabindex')).not.toBe('-1'));
    const groupResult = screen.getByRole('button', { name: 'Munich Climate Council' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Show instruction' })).toBeTruthy()
    );
    expect(groupResult.getAttribute('tabindex')).not.toBe('-1');
    expect(groupResult.closest('[inert]')).toBeNull();
    expect(linkTrigger.getAttribute('tabindex')).toBe('-1');

    fireEvent.click(groupResult);

    await screen.findByRole('heading', { name: 'Link as a child group' });
    expect(screen.getByRole('button', { name: 'Minimize instruction' })).toBeTruthy();
  });

  it('keeps the desktop coach expanded while allowing a portaled network group result', async () => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'link-climate-council',
        route: '/group/group-1/network?tab=manage-network',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <div data-slot="dialog-content">
        <div data-tutorial-anchor="network-group-search">
          <input aria-label="Group search" />
        </div>
        <div data-typeahead-dropdown>
          <button type="button">Munich Climate Council</button>
        </div>
        <AppTutorialOrchestrator />
      </div>
    );

    await screen.findByRole('heading', { name: 'Find Munich Climate Council' });
    const result = screen.getByRole('button', { name: 'Munich Climate Council' });

    await waitFor(() => expect(result.getAttribute('tabindex')).not.toBe('-1'));
    expect(result.closest('[inert]')).toBeNull();
    expect(
      screen.getByText(
        'Open Link Group. Then search for the exact group name and select the result.'
      )
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show instruction' })).toBeNull();
  });

  it('prefers the visible rights selector over the link trigger', async () => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'request-climate-council-rights',
        route: '/group/group-1/network?tab=manage-network',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <button data-tutorial-anchor="link-group">Link Group</button>
        <div data-tutorial-anchor="network-rights-selector">
          <input type="checkbox" aria-label="Information Right" />
        </div>
        <AppTutorialOrchestrator />
      </>
    );

    await screen.findByRole('heading', { name: 'Change right directions' });
    await waitFor(() =>
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ inline: 'center' })
      )
    );
    expect(
      screen.getByRole('checkbox', { name: 'Information Right' }).getAttribute('tabindex')
    ).not.toBe('-1');
    expect(screen.getByRole('button', { name: 'Link Group' }).getAttribute('tabindex')).toBe('-1');
  });

  it('recognizes an already selected pair of rights from stable internal keys', async () => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'select-climate-council-rights',
        route: '/group/group-1/network?tab=manage-network',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <div
          data-testid="rights-selector"
          data-tutorial-anchor="network-rights-selector"
          data-tutorial-input-values={JSON.stringify(['informationRight amendmentRight'])}
        >
          <input type="checkbox" aria-label="Informationsrecht" defaultChecked />
          <input type="checkbox" aria-label="Antragsrecht" defaultChecked />
        </div>
        <AppTutorialOrchestrator />
      </>
    );

    const selector = await screen.findByTestId('rights-selector');
    expect(tutorialInputValuesFor(selector)).toEqual(['informationRight amendmentRight']);
    await waitFor(() =>
      expect(mocks.advanceTutorial).toHaveBeenCalledWith(2, 'select-climate-council-rights', {
        type: 'input',
        value: 'informationRight amendmentRight',
      })
    );
  });

  it('starts an interactive mobile step compact and exposes the same body as details', async () => {
    useScreenStore.setState({ isMobileScreen: true });
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'search-initiative',
        route: '/search',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <input data-tutorial-anchor="search-input" />
        <AppTutorialOrchestrator />
      </>
    );

    await screen.findByRole('heading', { name: 'Find the initiative' });
    expect(
      screen.getByTestId('app-tutorial-spotlight').getAttribute('data-tutorial-checkpoint')
    ).toBe('search-initiative');
    const details = screen.getByRole('button', { name: 'Show details' });
    expect(details.getAttribute('aria-expanded')).toBe('false');
    expect(
      screen.queryByText(
        'Sandbox content appears only in your search and remains invisible to every other user.'
      )
    ).toBeNull();
    expect(screen.getByText('Search for “Climate-Friendly Euckenstraße Initiative”.')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Copy: Climate-Friendly Euckenstraße Initiative',
      })
    ).toBeTruthy();

    fireEvent.click(details);

    expect(screen.getByRole('button', { name: 'Hide details' }).getAttribute('aria-expanded')).toBe(
      'true'
    );
    const body = screen.getByText(
      'Sandbox content appears only in your search and remains invisible to every other user.'
    );
    expect(body.parentElement?.className).toContain('max-h-[30dvh]');
    expect(body.parentElement?.className).toContain('overflow-y-auto');
    expect(body.parentElement?.className).toContain('[scrollbar-gutter:stable]');

    fireEvent.click(screen.getByRole('button', { name: 'Minimize instruction' }));

    const card = screen.getByTestId('app-tutorial-coach-card');
    const expanded = document.getElementById('app-tutorial-expanded-instruction');
    const showInstruction = screen.getByRole('button', { name: 'Show instruction' });
    expect(card.style.height).toBe('76px');
    expect(expanded?.parentElement?.className).toContain('h-full');
    expect(expanded?.parentElement?.firstElementChild?.className).toContain('h-full');
    expect(expanded?.parentElement?.firstElementChild?.className).toContain('items-center');
    expect(expanded?.hidden).toBe(true);
    expect(showInstruction.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('heading', { name: 'Find the initiative' })).toBeTruthy();

    fireEvent.click(showInstruction);

    expect(expanded?.hidden).toBe(false);
    expect(screen.getByRole('button', { name: 'Hide details' }).getAttribute('aria-expanded')).toBe(
      'true'
    );
    expect(body).toBeTruthy();
  });

  it('keeps the mobile network task coach inside the visual viewport', async () => {
    useScreenStore.setState({ isMobileScreen: true });
    const visualViewport = {
      addEventListener: vi.fn(),
      offsetLeft: 20,
      removeEventListener: vi.fn(),
      width: 360,
    };
    vi.stubGlobal('visualViewport', visualViewport);
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'open-network-todo',
        route: '/group/group-1/operation',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    const { unmount } = render(
      <>
        <button data-tutorial-anchor="tutorial-network-todo">Network todo</button>
        <AppTutorialOrchestrator />
      </>
    );

    await screen.findByRole('heading', { name: 'Network task' });
    await waitFor(() =>
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ inline: 'nearest' })
      )
    );

    const card = screen.getByTestId('app-tutorial-coach-card');
    const content = card.querySelector<HTMLElement>('[data-slot="card-content"]');
    const instruction = screen.getByText('Open the assigned network task.');
    const expanded = document.getElementById('app-tutorial-expanded-instruction');
    const header = expanded?.previousElementSibling;

    expect(card.style.left).toBe('32px');
    expect(card.style.width).toBe('336px');
    expect(card.className).toContain('min-w-0');
    expect(card.className).toContain('overflow-x-hidden');
    expect(card.className).toContain('[scrollbar-gutter:stable]');
    expect(content?.className).toContain('min-w-0');
    expect(content?.className).toContain('overflow-x-hidden');
    expect(expanded?.className).not.toContain('overflow-x-hidden');
    expect(header?.className).toContain('grid-cols-[minmax(0,1fr)_auto]');
    expect(instruction.className).toContain('[overflow-wrap:anywhere]');
    expect(visualViewport.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(visualViewport.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));

    unmount();

    expect(visualViewport.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(visualViewport.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('starts an explanatory mobile step expanded with Continue visible', async () => {
    useScreenStore.setState({ isMobileScreen: true });
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'view-ai-skills',
        route: '/user/user-1/settings?tab=ai',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <div data-tutorial-anchor="settings-ai-skills">AI skills</div>
        <AppTutorialOrchestrator />
      </>
    );

    expect(
      await screen.findByText('Skills give Assistent Aria & Kai reusable domain instructions.')
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide details' }).getAttribute('aria-expanded')).toBe(
      'true'
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('centers mobile search after Create without requiring a reload', async () => {
    useScreenStore.setState({ isMobileScreen: true });
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'open-create',
        route: '/home',
        revision: 1,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });
    mocks.advanceTutorial.mockResolvedValueOnce({
      completed: false,
      route: '/create',
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'open-search',
        route: '/create',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <div
        data-testid="mobile-primary-navigation-scroller"
        data-tutorial-horizontal-scroller="primary-navigation"
      >
        <button data-tutorial-anchor="primary-create">Create navigation</button>
        <button data-tutorial-anchor="primary-search">Search navigation</button>
        <AppTutorialOrchestrator />
      </div>
    );

    const scroller = screen.getByTestId('mobile-primary-navigation-scroller');
    const search = screen.getByRole('button', { name: 'Search navigation' });
    const scrollTo = vi.fn(({ left }: ScrollToOptions) => {
      scroller.scrollLeft = left ?? scroller.scrollLeft;
    });
    Object.defineProperties(scroller, {
      clientWidth: { configurable: true, value: 240 },
      scrollLeft: { configurable: true, value: 380, writable: true },
      scrollTo: { configurable: true, value: scrollTo },
      scrollWidth: { configurable: true, value: 640 },
    });
    scroller.getBoundingClientRect = vi.fn().mockReturnValue({
      bottom: 800,
      height: 64,
      left: 0,
      right: 240,
      top: 736,
      width: 240,
      x: 0,
      y: 736,
      toJSON: () => undefined,
    });
    search.getBoundingClientRect = vi.fn(() => {
      const left = 300 - scroller.scrollLeft;
      return {
        bottom: 784,
        height: 48,
        left,
        right: left + 48,
        top: 736,
        width: 48,
        x: left,
        y: 736,
        toJSON: () => undefined,
      };
    });

    await screen.findByRole('heading', { name: 'Start initiatives' });
    fireEvent.click(screen.getByRole('button', { name: 'Create navigation' }));

    await screen.findByRole('heading', { name: 'Global search' });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'auto', left: 204 });
    expect(
      screen.getByTestId('app-tutorial-spotlight').getAttribute('data-tutorial-checkpoint')
    ).toBe('open-search');

    scroller.scrollLeft = 380;
    fireEvent.scroll(scroller);
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', left: 204 });
  });

  it('clamps the centered mobile search position to the primary bar range', async () => {
    useScreenStore.setState({ isMobileScreen: true });
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'open-search',
        route: '/create',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <div
        data-testid="mobile-primary-navigation-scroller"
        data-tutorial-horizontal-scroller="primary-navigation"
      >
        <button data-tutorial-anchor="primary-search">Search navigation</button>
        <AppTutorialOrchestrator />
      </div>
    );

    const scroller = screen.getByTestId('mobile-primary-navigation-scroller');
    const search = screen.getByRole('button', { name: 'Search navigation' });
    const scrollTo = vi.fn();
    Object.defineProperties(scroller, {
      clientWidth: { configurable: true, value: 240 },
      scrollLeft: { configurable: true, value: 380, writable: true },
      scrollTo: { configurable: true, value: scrollTo },
      scrollWidth: { configurable: true, value: 640 },
    });
    scroller.getBoundingClientRect = vi.fn().mockReturnValue({
      bottom: 800,
      height: 64,
      left: 0,
      right: 240,
      top: 736,
      width: 240,
      x: 0,
      y: 736,
      toJSON: () => undefined,
    });
    search.getBoundingClientRect = vi.fn().mockReturnValue({
      bottom: 784,
      height: 48,
      left: 500,
      right: 548,
      top: 736,
      width: 48,
      x: 500,
      y: 736,
      toJSON: () => undefined,
    });

    await screen.findByRole('heading', { name: 'Global search' });
    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'auto', left: 400 });
  });

  it('does not reposition primary search on desktop', async () => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'open-search',
        route: '/create',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <div
        data-testid="desktop-primary-navigation-scroller"
        data-tutorial-horizontal-scroller="primary-navigation"
      >
        <button data-tutorial-anchor="primary-search">Search navigation</button>
        <AppTutorialOrchestrator />
      </div>
    );

    const scroller = screen.getByTestId('desktop-primary-navigation-scroller');
    const scrollTo = vi.fn();
    Object.defineProperties(scroller, {
      clientWidth: { configurable: true, value: 240 },
      scrollLeft: { configurable: true, value: 180, writable: true },
      scrollTo: { configurable: true, value: scrollTo },
      scrollWidth: { configurable: true, value: 640 },
    });

    await screen.findByRole('heading', { name: 'Global search' });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('still publishes mobile search when no primary bar scroller is present', async () => {
    useScreenStore.setState({ isMobileScreen: true });
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'open-search',
        route: '/create',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <button data-tutorial-anchor="primary-search">Search navigation</button>
        <AppTutorialOrchestrator />
      </>
    );

    expect(await screen.findByRole('heading', { name: 'Global search' })).toBeTruthy();
    expect(screen.getByTestId('app-tutorial-target-outline')).toBeTruthy();
  });

  it('resets mobile details to the next checkpoint default', async () => {
    useScreenStore.setState({ isMobileScreen: true });
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'open-search',
        route: '/create',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });
    mocks.advanceTutorial.mockResolvedValueOnce({
      completed: false,
      route: '/search',
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'search-initiative',
        route: '/search',
        revision: 3,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <button data-tutorial-anchor="primary-search">Search navigation</button>
        <input data-tutorial-anchor="search-input" />
        <AppTutorialOrchestrator />
      </>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Show details' }));
    expect(screen.getByRole('button', { name: 'Hide details' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Minimize instruction' }));
    expect(screen.getByRole('button', { name: 'Show instruction' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Search navigation' }));

    await screen.findByRole('heading', { name: 'Find the initiative' });
    expect(
      screen.getByRole('button', { name: 'Minimize instruction' }).getAttribute('aria-expanded')
    ).toBe('true');
    expect(document.getElementById('app-tutorial-expanded-instruction')?.hidden).toBe(false);
    expect(screen.getByRole('button', { name: 'Show details' }).getAttribute('aria-expanded')).toBe(
      'false'
    );
  });

  it('keeps the full body visible without a details control on desktop', async () => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'search-initiative',
        route: '/search',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <input data-tutorial-anchor="search-input" />
        <AppTutorialOrchestrator />
      </>
    );

    expect(
      await screen.findByText(
        'Sandbox content appears only in your search and remains invisible to every other user.'
      )
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show details' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hide details' })).toBeNull();
  });

  async function renderPrimaryNavigation(scrollRangePixels: number) {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'primary-navigation',
        route: '/home',
        revision: 0,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    const view = render(
      <>
        <div data-tutorial-anchor="primary-navigation" data-testid="primary-navigation">
          <div
            data-tutorial-horizontal-scroller="primary-navigation"
            data-testid="primary-navigation-scroller"
          >
            Navigation items
          </div>
        </div>
        <AppTutorialOrchestrator />
      </>
    );
    const scroller = screen.getByTestId('primary-navigation-scroller');
    Object.defineProperties(scroller, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: 100 + scrollRangePixels },
    });
    await screen.findByRole('heading', { name: 'Navigation' });
    return {
      ...view,
      scroller,
      target: screen.getByTestId('primary-navigation'),
    };
  }

  it('shows the desktop-optimized guidance only in the first mobile step', async () => {
    useScreenStore.setState({ isMobileScreen: true });
    await renderPrimaryNavigation(100);

    expect(
      screen.getByText(
        'This tutorial is optimized for desktop. On mobile, you may need to collapse the tutorial instructions, perform an action, and expand them again afterward.'
      )
    ).toBeTruthy();
  });

  it('advances mobile navigation after a normal 48 pixel scroll', async () => {
    const { scroller } = await renderPrimaryNavigation(100);

    scroller.scrollLeft = 48;
    fireEvent.scroll(scroller);

    await waitFor(() =>
      expect(mocks.advanceTutorial).toHaveBeenCalledWith(0, 'primary-navigation', {
        type: 'scroll',
        scrollPixels: 48,
        scrollRangePixels: 100,
      })
    );
  });

  it('accepts the full available scroll range when it is shorter than 48 pixels', async () => {
    const { scroller } = await renderPrimaryNavigation(24);

    scroller.scrollLeft = 24;
    fireEvent.scroll(scroller);

    await waitFor(() =>
      expect(mocks.advanceTutorial).toHaveBeenCalledWith(0, 'primary-navigation', {
        type: 'scroll',
        scrollPixels: 24,
        scrollRangePixels: 24,
      })
    );
  });

  it('counts horizontal scroll movement cumulatively across direction changes', async () => {
    const { scroller } = await renderPrimaryNavigation(100);

    scroller.scrollLeft = 30;
    fireEvent.scroll(scroller);
    expect(mocks.advanceTutorial).not.toHaveBeenCalled();

    scroller.scrollLeft = 10;
    fireEvent.scroll(scroller);

    await waitFor(() =>
      expect(mocks.advanceTutorial).toHaveBeenCalledWith(0, 'primary-navigation', {
        type: 'scroll',
        scrollPixels: 50,
        scrollRangePixels: 100,
      })
    );
  });

  it('accepts a horizontal swipe without overflow and ignores a vertical swipe', async () => {
    const { target } = await renderPrimaryNavigation(0);

    fireEvent.pointerDown(target, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 105, clientY: 160, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 105, clientY: 160, pointerId: 1 });
    expect(mocks.advanceTutorial).not.toHaveBeenCalled();

    fireEvent.pointerDown(target, { clientX: 100, clientY: 100, pointerId: 2 });
    fireEvent.pointerMove(target, { clientX: 45, clientY: 105, pointerId: 2 });

    await waitFor(() =>
      expect(mocks.advanceTutorial).toHaveBeenCalledWith(0, 'primary-navigation', {
        type: 'scroll',
        scrollPixels: 55,
        scrollRangePixels: 0,
      })
    );
  });

  it('continues to show Continue for primary navigation on desktop', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        matches: true,
        removeEventListener: vi.fn(),
      })
    );
    const { scroller } = await renderPrimaryNavigation(100);

    expect(
      screen.queryByText(
        'This tutorial is optimized for desktop. On mobile, you may therefore need to collapse the tutorial instructions, perform an action, and expand them again afterward.'
      )
    ).toBeNull();
    scroller.scrollLeft = 48;
    fireEvent.scroll(scroller);
    expect(mocks.advanceTutorial).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() =>
      expect(mocks.advanceTutorial).toHaveBeenCalledWith(0, 'primary-navigation', {
        type: 'acknowledge',
        desktopAcknowledged: true,
      })
    );
  });

  it('loads the run once when the orchestrator mounts', async () => {
    const view = render(
      <>
        <div data-tutorial-anchor="tutorial-network-pending">Pending request</div>
        <AppTutorialOrchestrator />
      </>
    );

    await waitFor(() => expect(mocks.loadTutorialRun).toHaveBeenCalledTimes(1));
    view.rerender(
      <>
        <div data-tutorial-anchor="tutorial-network-pending">Pending request</div>
        <AppTutorialOrchestrator />
      </>
    );
    expect(mocks.loadTutorialRun).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['view-ai-skills', 'settings-ai-skills', 'AI skills'],
    ['view-ai-tools', 'settings-ai-tools', 'Tools'],
  ])('shows Continue for the non-interactive %s card', async (checkpointId, anchor, title) => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: checkpointId,
        route: '/user/user-1/settings?tab=ai',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <div data-tutorial-anchor={anchor}>{title}</div>
        <AppTutorialOrchestrator />
      </>
    );

    expect(await screen.findByRole('heading', { name: title })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('advances AI skills once without creating a nested instruction scroller', async () => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'view-ai-skills',
        route: '/user/user-1/settings?tab=ai',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });
    mocks.advanceTutorial.mockResolvedValueOnce({
      completed: false,
      route: '/user/user-1/settings?tab=ai',
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'view-ai-tools',
        route: '/user/user-1/settings?tab=ai',
        revision: 3,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <div data-tutorial-anchor="settings-ai-skills">AI skills settings</div>
        <div data-tutorial-anchor="settings-ai-tools">AI tools settings</div>
        <AppTutorialOrchestrator />
      </>
    );

    expect(await screen.findByRole('heading', { name: 'AI skills' })).toBeTruthy();
    expect(document.getElementById('app-tutorial-expanded-instruction')?.className).not.toContain(
      'overflow-x-hidden'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Tools' })).toBeTruthy();
    expect(mocks.advanceTutorial).toHaveBeenCalledTimes(1);
    expect(mocks.advanceTutorial).toHaveBeenCalledWith(2, 'view-ai-skills', {
      type: 'view',
      anchor: 'settings-ai-skills',
    });
  });

  it('aligns a late change-request overview once and advances it with one click', async () => {
    let revealOverview: () => void = () => undefined;
    let resolveAdvance!: (result: {
      completed: false;
      route: string;
      run: {
        runId: string;
        status: 'active';
        currentCheckpointId: 'open-amendment-process';
        route: string;
        revision: number;
        expiresAt: string;
      };
    }) => void;
    const advanceResult = new Promise<Parameters<typeof resolveAdvance>[0]>(resolve => {
      resolveAdvance = resolve;
    });
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'open-change-requests',
        route: '/amendment/amendment-1/change-requests',
        revision: 8,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });
    mocks.advanceTutorial.mockReturnValueOnce(advanceResult);

    function DynamicOverview() {
      const [visible, setVisible] = useState(false);
      revealOverview = () => setVisible(true);
      return (
        <>
          {visible ? (
            <div
              data-testid="dynamic-change-request-overview"
              data-tutorial-anchor="tutorial-change-request-overview"
            />
          ) : (
            <div data-testid="change-request-skeleton">Loading</div>
          )}
          <button data-tutorial-anchor="secondary-process">Process navigation</button>
        </>
      );
    }

    render(
      <>
        <DynamicOverview />
        <AppTutorialOrchestrator />
      </>
    );

    expect(screen.queryByRole('heading', { name: 'Change overview' })).toBeNull();
    act(() => revealOverview());

    expect(await screen.findByRole('heading', { name: 'Change overview' })).toBeTruthy();
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'auto',
      block: 'center',
      inline: 'center',
    });

    const overview = screen.getByTestId('dynamic-change-request-overview');
    await act(async () => {
      overview.append(document.createElement('article'), document.createElement('article'));
      await Promise.resolve();
    });
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1);

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    act(() => {
      continueButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      continueButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.advanceTutorial).toHaveBeenCalledTimes(1);
    expect(continueButton.getAttribute('aria-busy')).toBe('true');
    expect(continueButton).toHaveProperty('disabled', true);
    fireEvent.click(continueButton);
    expect(mocks.advanceTutorial).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAdvance({
        completed: false,
        route: '/amendment/amendment-1/change-requests',
        run: {
          runId: 'run-1',
          status: 'active',
          currentCheckpointId: 'open-amendment-process',
          route: '/amendment/amendment-1/change-requests',
          revision: 9,
          expiresAt: '2026-08-25T00:00:00.000Z',
        },
      });
      await advanceResult;
    });

    expect(await screen.findByRole('heading', { name: 'Process' })).toBeTruthy();
    expect(mocks.advanceTutorial).toHaveBeenCalledWith(8, 'open-change-requests', {
      type: 'view',
      anchor: 'tutorial-change-request-overview',
    });
  });

  it('keeps the coach position stable between pointer down and pointer up', async () => {
    let targetTop = 100;
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'open-change-requests',
        route: '/amendment/amendment-1/change-requests',
        revision: 8,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <div
          ref={element => {
            if (!element) return;
            element.getBoundingClientRect = () =>
              ({
                bottom: targetTop + 60,
                height: 60,
                left: 20,
                right: 320,
                top: targetTop,
                width: 300,
                x: 20,
                y: targetTop,
                toJSON: () => undefined,
              }) as DOMRect;
          }}
          data-tutorial-anchor="tutorial-change-request-overview"
        >
          Change requests
        </div>
        <AppTutorialOrchestrator />
      </>
    );

    const card = await screen.findByTestId('app-tutorial-coach-card');
    expect(card.style.top).toBe('94px');

    fireEvent.pointerDown(card);
    targetTop = 300;
    fireEvent.scroll(window);

    await waitFor(() =>
      expect(screen.getByTestId('app-tutorial-target-outline').style.top).toBe('294px')
    );
    expect(card.style.top).toBe('94px');

    fireEvent.pointerUp(window);
    await waitFor(() => expect(card.style.top).toBe('294px'));
  });

  it('keeps the pending network request visible until the user selects Continue', async () => {
    render(
      <>
        <div data-tutorial-anchor="tutorial-network-pending">Pending request</div>
        <AppTutorialOrchestrator />
      </>
    );

    const continueButton = await screen.findByRole('button', {
      name: 'Continue',
    });
    expect(screen.getByRole('heading', { name: 'Request pending' })).toBeTruthy();
    expect(mocks.advanceTutorial).not.toHaveBeenCalled();
    expect(screen.queryByText('Network connection request was not found')).toBeNull();

    fireEvent.click(continueButton);

    await waitFor(() =>
      expect(mocks.advanceTutorial).toHaveBeenCalledWith(4, 'view-network-pending', {
        type: 'view',
        anchor: 'tutorial-network-pending',
      })
    );
    expect(
      await screen.findByText('Waiting for the other group to accept the request …')
    ).toBeTruthy();
  });

  it('shows the accepted link on the management page before opening the flow map', async () => {
    const approvalRequested = vi.fn();
    window.addEventListener(APP_TUTORIAL_ACCEPT_NETWORK_EVENT, approvalRequested);
    mocks.advanceTutorial
      .mockResolvedValueOnce({
        completed: false,
        route: '/group/group-1/network?tab=manage-network',
        run: {
          runId: 'run-1',
          status: 'active',
          currentCheckpointId: 'view-network-confirmed',
          route: '/group/group-1/network?tab=manage-network',
          revision: 5,
          expiresAt: '2026-08-25T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        completed: false,
        route: '/group/group-1/network?tab=current-network',
        run: {
          runId: 'run-1',
          status: 'active',
          currentCheckpointId: 'view-network-flow',
          route: '/group/group-1/network?tab=current-network',
          revision: 6,
          expiresAt: '2026-08-25T00:00:00.000Z',
        },
      });

    render(
      <>
        <div data-tutorial-anchor="tutorial-network-pending">Pending request</div>
        <div data-tutorial-anchor="tutorial-network-confirmed">Accepted link</div>
        <AppTutorialOrchestrator />
      </>
    );

    const pendingContinue = await screen.findByRole('button', {
      name: 'Continue',
    });
    expect(screen.getByRole('heading', { name: 'Request pending' })).toBeTruthy();

    fireEvent.click(pendingContinue);

    expect(await screen.findByRole('heading', { name: 'Link accepted' })).toBeTruthy();
    expect(approvalRequested).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'Process path' })).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(mocks.advanceTutorial).toHaveBeenLastCalledWith(5, 'view-network-confirmed', {
        type: 'view',
        anchor: 'tutorial-network-confirmed',
      })
    );
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/group/group-1/network?tab=current-network',
      replace: true,
    });
    window.removeEventListener(APP_TUTORIAL_ACCEPT_NETWORK_EVENT, approvalRequested);
  });

  it('keeps the membership request visible until the user selects Continue', async () => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'view-membership-request',
        route: '/user/user-1/memberships',
        revision: 3,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <div data-tutorial-anchor="tutorial-membership-request">Pending membership</div>
        <AppTutorialOrchestrator />
      </>
    );

    const continueButton = await screen.findByRole('button', { name: 'Continue' });
    expect(mocks.advanceTutorial).not.toHaveBeenCalled();

    fireEvent.click(continueButton);

    await waitFor(() =>
      expect(mocks.advanceTutorial).toHaveBeenCalledWith(3, 'view-membership-request', {
        type: 'view',
        anchor: 'tutorial-membership-request',
      })
    );
    expect(
      await screen.findByText('Waiting for the initiative to accept your membership request …')
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('automatically retries a pending membership effect after one Continue click', async () => {
    let resolveRetry!: (result: {
      completed: false;
      route: string;
      run: {
        runId: string;
        status: 'active';
        currentCheckpointId: 'open-notifications';
        route: string;
        revision: number;
        expiresAt: string;
      };
    }) => void;
    const retryResult = new Promise<Parameters<typeof resolveRetry>[0]>(resolve => {
      resolveRetry = resolve;
    });
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'view-membership-request',
        route: '/user/user-1/memberships',
        revision: 3,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });
    mocks.advanceTutorial
      .mockResolvedValueOnce({
        completed: false,
        pending: true,
        route: '/user/user-1/memberships',
      })
      .mockReturnValueOnce(retryResult);

    render(
      <>
        <div data-tutorial-anchor="tutorial-membership-request">Pending membership</div>
        <button data-tutorial-anchor="primary-notifications">Notifications</button>
        <AppTutorialOrchestrator />
      </>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('Waiting for the initiative to accept your membership request …')
    ).toBeTruthy();
    await waitFor(() => expect(mocks.advanceTutorial).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveRetry({
        completed: false,
        route: '/user/user-1/memberships',
        run: {
          runId: 'run-1',
          status: 'active',
          currentCheckpointId: 'open-notifications',
          route: '/user/user-1/memberships',
          revision: 4,
          expiresAt: '2026-08-25T00:00:00.000Z',
        },
      });
      await retryResult;
    });

    expect(await screen.findByRole('heading', { name: 'Notification' })).toBeTruthy();
    expect(mocks.advanceTutorial).toHaveBeenNthCalledWith(2, 3, 'view-membership-request', {
      type: 'view',
      anchor: 'tutorial-membership-request',
    });
  });

  it('defers the profile target until the avatar menu has finished loading', () => {
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    const profile = document.createElement('a');
    profile.dataset.tutorialAnchor = 'avatar-profile';
    const loading = document.createElement('div');
    loading.dataset.testid = 'user-menu-navigation-loading';
    menu.append(profile, loading);
    document.body.append(menu);

    expect(visibleTutorialTarget('avatar-profile')).toBeNull();

    loading.remove();
    expect(visibleTutorialTarget('avatar-profile')).toBe(profile);
    menu.remove();
  });

  it('targets the primary card link instead of actions inside a tutorial search result', () => {
    const result = document.createElement('div');
    result.dataset.tutorialAnchor = 'tutorial-search-result';
    const primaryLink = document.createElement('a');
    primaryLink.dataset.linkSurfacePrimary = '';
    const joinButton = document.createElement('button');
    joinButton.textContent = 'Join';
    result.append(primaryLink, joinButton);
    document.body.append(result);

    expect(visibleTutorialTarget('tutorial-search-result')).toBe(primaryLink);

    result.remove();
  });

  it.each([
    'network-group-search',
    'city-design-location-search',
    'tutorial-process-start-group',
    'tutorial-process-target-group',
  ])('includes a visible portaled dropdown in the %s spotlight', anchor => {
    const addressFields = document.createElement('div');
    const dropdown = document.createElement('div');
    dropdown.setAttribute('data-typeahead-dropdown', '');
    document.body.append(addressFields, dropdown);
    addressFields.getBoundingClientRect = vi.fn().mockReturnValue({
      bottom: 160,
      height: 60,
      left: 20,
      right: 320,
      top: 100,
      width: 300,
      x: 20,
      y: 100,
      toJSON: () => undefined,
    });
    dropdown.getBoundingClientRect = vi.fn().mockReturnValue({
      bottom: 420,
      height: 260,
      left: 20,
      right: 320,
      top: 160,
      width: 300,
      x: 20,
      y: 160,
      toJSON: () => undefined,
    });

    expect(tutorialSpotlightRectFor(addressFields, anchor)).toMatchObject({
      top: 94,
      bottom: 426,
      height: 332,
    });
    addressFields.remove();
    dropdown.remove();
  });

  it('matches the Yes button bounds exactly without spotlight padding', () => {
    const yesButton = document.createElement('button');
    yesButton.getBoundingClientRect = vi.fn().mockReturnValue({
      bottom: 160,
      height: 60,
      left: 20,
      right: 320,
      top: 100,
      width: 300,
      x: 20,
      y: 100,
      toJSON: () => undefined,
    });

    expect(tutorialSpotlightRectFor(yesButton, 'agenda-amendment-yes')).toMatchObject({
      top: 100,
      bottom: 160,
      left: 20,
      right: 320,
      height: 60,
      width: 300,
    });
  });

  it('tracks the Yes button while its entrance animation changes position', async () => {
    let top = 108;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      bottom: top + 60,
      height: 60,
      left: 20,
      right: 320,
      top,
      width: 300,
      x: 20,
      y: top,
      toJSON: () => undefined,
    }));
    const animationFrames: FrameRequestCallback[] = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      })
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'select-amendment-yes',
        route: '/event/event-1/agenda/item-1',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <button data-tutorial-anchor="agenda-amendment-yes">Yes</button>
        <AppTutorialOrchestrator />
      </>
    );

    await waitFor(() => expect(animationFrames.length).toBeGreaterThan(0));
    act(() => animationFrames.shift()?.(0));
    const outline = await screen.findByTestId('app-tutorial-target-outline');
    expect(outline.style.top).toBe('108px');
    expect(animationFrames.length).toBeGreaterThan(0);

    top = 100;
    act(() => {
      for (const callback of animationFrames.splice(0)) callback(16);
    });

    await waitFor(() => expect(outline.style.top).toBe('100px'));
  });

  it('waits for the real click before advancing the Yes selection checkpoint', async () => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'select-amendment-yes',
        route: '/event/event-1/agenda/item-1',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    function VotingChoice() {
      const [selected, setSelected] = useState(false);
      return (
        <button
          data-tutorial-anchor="agenda-amendment-yes"
          aria-pressed={selected}
          onClick={() => setSelected(true)}
        >
          Yes
        </button>
      );
    }

    render(
      <>
        <VotingChoice />
        <AppTutorialOrchestrator />
      </>
    );

    const yes = await screen.findByRole('button', { name: 'Yes' });
    await screen.findByTestId('app-tutorial-target-outline');
    await act(async () => {
      fireEvent.pointerDown(yes);
      await new Promise(resolve => window.setTimeout(resolve));
    });
    expect(mocks.advanceTutorial).not.toHaveBeenCalled();
    expect(yes.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(yes);

    expect(yes.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() =>
      expect(mocks.advanceTutorial).toHaveBeenCalledWith(2, 'select-amendment-yes', {
        type: 'click',
        anchor: 'agenda-amendment-yes',
      })
    );
  });

  it('advances the Tasks checkpoint from the assistant output todo card', async () => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'open-todos',
        route: '/messages',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <a data-tutorial-anchor="tutorial-assistant-todo-output" href="/todos">
          Created todo
        </a>
        <AppTutorialOrchestrator />
      </>
    );

    expect(await screen.findByRole('heading', { name: 'Tasks' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Created todo' }));

    await waitFor(() =>
      expect(mocks.advanceTutorial).toHaveBeenCalledWith(2, 'open-todos', {
        type: 'click',
        anchor: 'tutorial-assistant-todo-output',
      })
    );
  });

  it('moves the assistant prompt spotlight to the chat while the response is pending', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const left = this.dataset.tutorialAnchor === 'tutorial-assistant-chat' ? 400 : 20;
      return {
        bottom: 160,
        height: 60,
        left,
        right: left + 300,
        top: 100,
        width: 300,
        x: left,
        y: 100,
        toJSON: () => undefined,
      };
    });
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'ask-assistant-for-todo',
        route: '/messages',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <div data-tutorial-anchor="message-composer">Composer</div>
        <div data-tutorial-anchor="tutorial-assistant-chat">Chat</div>
        <AppTutorialOrchestrator />
      </>
    );

    const outline = await screen.findByTestId('app-tutorial-target-outline');
    expect(outline.style.left).toBe('14px');

    act(() => requestAppTutorialSpotlightTarget('tutorial-assistant-chat'));

    await waitFor(() =>
      expect(screen.getByTestId('app-tutorial-target-outline').style.left).toBe('394px')
    );
    expect(mocks.advanceTutorial).not.toHaveBeenCalled();
  });

  it('copies prescribed tutorial input without completing the checkpoint', async () => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'search-initiative',
        route: '/search',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <input data-tutorial-anchor="search-input" />
        <AppTutorialOrchestrator />
      </>
    );

    const copyButton = await screen.findByRole('button', {
      name: 'Copy: Climate-Friendly Euckenstraße Initiative',
    });
    expect(
      screen.getByText('Search for “Climate-Friendly Euckenstraße Initiative”.').parentElement
        ?.className
    ).toContain('flex');

    fireEvent.click(copyButton);

    await waitFor(() =>
      expect(mocks.writeClipboard).toHaveBeenCalledWith('Climate-Friendly Euckenstraße Initiative')
    );
    expect(await screen.findByText('Copied')).toBeTruthy();
    expect(mocks.advanceTutorial).not.toHaveBeenCalled();
  });

  it('offers separate copy actions for the tutorial street and house number', async () => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'select-city-design-address',
        route: '/amendment/amendment-1/citydesign',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <div data-tutorial-anchor="city-design-location-search">Location fields</div>
        <AppTutorialOrchestrator />
      </>
    );

    const streetCopyButton = await screen.findByRole('button', { name: 'Copy: Euckenstraße' });
    const instruction = screen.getByText(
      'Enter Euckenstraße in the Street field and select the result. Then enter 38 in the House Number field and select that result.'
    );
    expect(instruction.parentElement?.className).toContain('grid-cols-[auto_minmax(0,1fr)]');
    expect(streetCopyButton.parentElement?.className).toContain('col-start-2');

    fireEvent.click(streetCopyButton);
    await waitFor(() => expect(mocks.writeClipboard).toHaveBeenCalledWith('Euckenstraße'));
    expect(screen.getByText('Euckenstraße · Copied')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copy: 38' }));
    await waitFor(() => expect(mocks.writeClipboard).toHaveBeenCalledWith('38'));
    expect(screen.getByText('38 · Copied')).toBeTruthy();
    expect(screen.getByText('Euckenstraße · Copy')).toBeTruthy();
    expect(mocks.advanceTutorial).not.toHaveBeenCalled();
  });

  it.each([
    ['confirm-amendment-vote', 'agenda-amendment-submit'],
    ['confirm-election-vote', 'agenda-election-submit'],
  ])('automatically restores the voting selection for %s', async (checkpointId, anchor) => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: checkpointId,
        route: '/event/event-1/agenda/item-1',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });
    const recover = vi.fn();
    window.addEventListener(APP_TUTORIAL_RECOVER_TARGET_EVENT, recover);

    render(
      <>
        <button data-tutorial-anchor={anchor} disabled>
          Confirm
        </button>
        <AppTutorialOrchestrator />
      </>
    );

    await waitFor(() =>
      expect(recover).toHaveBeenCalledWith(expect.objectContaining({ detail: { anchor } }))
    );
    window.removeEventListener(APP_TUTORIAL_RECOVER_TARGET_EVENT, recover);
  });

  it.each([
    ['submit-amendment-vote', 'agenda-amendment-password'],
    ['submit-election-vote', 'agenda-election-password'],
  ])('recovers the voting dialog target for %s without reloading', async (checkpointId, anchor) => {
    vi.useFakeTimers();
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: checkpointId,
        route: '/event/event-1/agenda/item-1',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });
    const recover = vi.fn();
    window.addEventListener(APP_TUTORIAL_RECOVER_TARGET_EVENT, recover);

    render(<AppTutorialOrchestrator />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => vi.advanceTimersByTime(8_000));

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(recover).toHaveBeenCalledOnce();
    expect(recover.mock.calls[0]?.[0]).toMatchObject({ detail: { anchor } });
    window.removeEventListener(APP_TUTORIAL_RECOVER_TARGET_EVENT, recover);
  });

  it.each([
    ['submit-amendment-vote', 'agenda-amendment-password'],
    ['submit-election-vote', 'agenda-election-password'],
  ])('copies 1234 for the %s checkpoint', async (checkpointId, anchor) => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: checkpointId,
        route: '/event/event-1/agenda/item-1',
        revision: 2,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <div data-tutorial-anchor={anchor}>PIN</div>
        <AppTutorialOrchestrator />
      </>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Copy: 1234' }));

    await waitFor(() => expect(mocks.writeClipboard).toHaveBeenCalledWith('1234'));
    expect(mocks.advanceTutorial).not.toHaveBeenCalled();
  });

  it('completes the change request checkpoint only for the prescribed suggestion text', async () => {
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'create-change-request',
        route: '/amendment/amendment-1/text',
        revision: 8,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <div data-tutorial-anchor="amendment-text-editor">Editor</div>
        <AppTutorialOrchestrator />
      </>
    );

    await screen.findByRole('heading', { name: 'Change request' });
    window.dispatchEvent(
      new CustomEvent(APP_TUTORIAL_ACTION_EVENT, {
        detail: {
          type: 'action',
          event: 'change-request.created',
          value: 'A different suggestion',
        },
      })
    );
    expect(mocks.advanceTutorial).not.toHaveBeenCalled();

    window.dispatchEvent(
      new CustomEvent(APP_TUTORIAL_ACTION_EVENT, {
        detail: {
          type: 'action',
          event: 'change-request.created',
          value: 'An accessible, shaded crossing is added at the intersection.',
        },
      })
    );

    await waitFor(() =>
      expect(mocks.advanceTutorial).toHaveBeenCalledWith(8, 'create-change-request', {
        type: 'action',
        event: 'change-request.created',
        value: 'An accessible, shaded crossing is added at the intersection.',
      })
    );
  });

  it('retries the real OSM load action after a tutorial load failure', async () => {
    useScreenStore.setState({ isMobileScreen: true });
    const retryLoad = vi.fn();
    mocks.loadTutorialRun.mockResolvedValueOnce({
      run: {
        runId: 'run-1',
        status: 'active',
        currentCheckpointId: 'load-city-design-osm',
        route: '/amendment/amendment-1/citydesign',
        revision: 7,
        expiresAt: '2026-08-25T00:00:00.000Z',
      },
    });

    render(
      <>
        <button data-tutorial-anchor="city-design-load-osm" onClick={retryLoad}>
          Load OSM
        </button>
        <AppTutorialOrchestrator />
      </>
    );

    await screen.findByRole('heading', { name: 'Load OSM' });
    expect(screen.getByRole('button', { name: 'Show details' }).getAttribute('aria-expanded')).toBe(
      'false'
    );
    window.dispatchEvent(
      new CustomEvent(APP_TUTORIAL_ACTION_EVENT, {
        detail: {
          type: 'action',
          event: APP_TUTORIAL_OSM_LOAD_FAILED_ACTION,
        },
      })
    );

    expect(await screen.findByText('The OSM data could not be loaded.')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry OSM loading' }));

    expect(retryLoad).toHaveBeenCalledTimes(1);
    expect(mocks.advanceTutorial).not.toHaveBeenCalled();
  });
});

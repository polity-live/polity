/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string },
  hash: '',
  previewData: {
    changeRequests: [
      { id: 'cr1', crId: 'CR-1', title: 'First', type: 'replace' },
      { id: 'cr2', crId: 'CR-2', title: 'Second', type: 'add' },
    ],
    documentValue: [{ type: 'p', children: [{ text: 'Document' }] }],
    discussions: [],
  },
  observerCallback: undefined as IntersectionObserverCallback | undefined,
  observerDisconnect: vi.fn(),
  flowProps: undefined as Record<string, unknown> | undefined,
  panelProps: undefined as Record<string, unknown> | undefined,
  networkStateOptions: undefined as Record<string, unknown> | undefined,
  nodeClick: vi.fn(),
  edgeClick: vi.fn(),
  setPanelCollapsed: vi.fn(),
  setLegendCollapsed: vi.fn(),
  toggleRight: vi.fn(),
  toggleDirection: vi.fn(),
  setDialogOpen: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useLocation: () => ({ hash: mocks.hash }) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('../PublicLandingPage', () => ({ PublicLandingPage: () => <div>public-page</div> }));
vi.mock('../AuthenticatedHomePageContainer', () => ({
  default: () => <div>authenticated-page</div>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    tArray: () => ['one', 'two', 'three'],
  }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/kit-platejs/plate-editor', () => ({
  PlateEditor: ({ documentTitle }: { documentTitle: string }) => <div>{documentTitle}</div>,
}));
vi.mock('@/features/change-requests/ui/ChangeRequestSummaryItem', () => ({
  ChangeRequestSummaryItem: ({
    identifier,
    motionDelayMs,
  }: {
    identifier: string;
    motionDelayMs: number;
  }) => <div data-delay={motionDelayMs}>{identifier}</div>,
}));
vi.mock('@/features/public-landing/hooks/useLandingAmendmentPreviewData', () => ({
  useLandingAmendmentPreviewData: () => mocks.previewData,
}));
vi.mock('../ProductStoryPoint', () => ({
  ProductStoryPoint: ({ text, icon: Icon }: { text: string; icon: () => ReactNode }) => (
    <div>
      {text}
      <Icon />
    </div>
  ),
}));
vi.mock('@/features/network/ui/NetworkFlowBase', () => ({
  NetworkFlowBase: (props: Record<string, any>) => {
    mocks.flowProps = props;
    return (
      <div>
        {props.panel}
        {props.children}
      </div>
    );
  },
}));
vi.mock('@/features/network/ui/NetworkControlPanel', () => ({
  NetworkControlPanel: (props: Record<string, any>) => {
    mocks.panelProps = props;
    return (
      <div>
        <button onClick={() => props.connectionDirectionFilters[0].onToggle()}>incoming</button>
        <button onClick={() => props.connectionDirectionFilters[1].onToggle()}>outgoing</button>
        <button onClick={() => props.onInteractiveChange(false)}>interactive</button>
      </div>
    );
  },
}));
vi.mock('@/features/network/ui/NetworkEntityDialog', () => ({
  NetworkEntityDialog: ({ open }: { open: boolean }) => (
    <div>{open ? 'dialog-open' : 'dialog-closed'}</div>
  ),
}));
vi.mock('@/features/network/ui/networkVisualHelpers', () => ({
  createGroupNodeLegendItem: (item: unknown) => item,
}));
vi.mock('@/features/public-landing/logic/landingNetworkPreview', () => ({
  landingNetworkAlwaysVisibleNodeIds: new Set(),
  landingNetworkEdges: [],
  landingNetworkNodes: [],
}));
vi.mock('@/features/public-landing/hooks/useLandingNetworkPreviewState', () => ({
  useLandingNetworkPreviewState: (options: Record<string, unknown>) => {
    mocks.networkStateOptions = options;
    return {
      visibleNodes: [],
      visibleEdges: [],
      onNodeClick: mocks.nodeClick,
      onEdgeClick: mocks.edgeClick,
      panelCollapsed: false,
      setPanelCollapsed: mocks.setPanelCollapsed,
      legendCollapsed: false,
      setLegendCollapsed: mocks.setLegendCollapsed,
      selectedRights: new Set(),
      toggleRight: mocks.toggleRight,
      selectedConnectionDirections: new Set(['incoming']),
      toggleConnectionDirection: mocks.toggleDirection,
      dialogOpen: false,
      setDialogOpen: mocks.setDialogOpen,
      selectedEntity: null,
    };
  },
}));
vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => `class-${key}`,
  featureThemeValue: (key: string) => `value-${key}`,
}));

import { HomePageContainer } from '../HomePageContainer';
import { LandingAmendmentSectionContentContainer } from '../LandingAmendmentSectionContent';
import { LandingNetworkFlowPreview } from '../LandingNetworkFlowPreview';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = null;
  mocks.hash = '';
  mocks.observerCallback = undefined;
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
});
afterEach(cleanup);

describe('public landing containers A07', () => {
  it('renders public landing without scrolling for empty and empty-section hashes', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const view = render(<HomePageContainer />);
    expect(screen.getByText('public-page')).toBeTruthy();
    expect(raf).not.toHaveBeenCalled();
    mocks.hash = '#';
    view.rerender(<HomePageContainer />);
    expect(raf).not.toHaveBeenCalled();
  });

  it('scrolls hash sections with and without a hash prefix and cancels queued frames', () => {
    let callback: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      callback = cb;
      return 17;
    });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const target = document.createElement('div');
    target.id = 'details';
    target.scrollIntoView = vi.fn();
    document.body.append(target);
    mocks.hash = '#details';
    const view = render(<HomePageContainer />);
    callback?.(0);
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    view.unmount();
    expect(cancel).toHaveBeenCalledWith(17);

    mocks.hash = 'missing';
    render(<HomePageContainer />);
    callback?.(0);
    target.remove();
  });

  it('renders the lazy authenticated home and bypasses public hash scrolling', async () => {
    mocks.user = { id: 'u1' };
    mocks.hash = '#details';
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    render(<HomePageContainer />);
    expect(await screen.findByText('authenticated-page')).toBeTruthy();
    expect(raf).not.toHaveBeenCalled();
  });

  it('renders amendment points and starts motion without IntersectionObserver', async () => {
    render(<LandingAmendmentSectionContentContainer />);
    expect(screen.getByText('one')).toBeTruthy();
    expect(screen.getByText('two')).toBeTruthy();
    expect(screen.getByText('three')).toBeTruthy();
    expect(screen.getByText('CR-1').getAttribute('data-delay')).toBe('0');
    expect(screen.getByText('CR-2').getAttribute('data-delay')).toBe('1200');
    await waitFor(() =>
      expect(document.querySelector('[data-motion-started="true"]')).toBeTruthy()
    );
  });

  it('waits for intersection, ignores non-intersections, starts once and disconnects', async () => {
    class Observer {
      constructor(callback: IntersectionObserverCallback) {
        mocks.observerCallback = callback;
      }
      observe() {
        return undefined;
      }
      disconnect = mocks.observerDisconnect;
      unobserve() {
        return undefined;
      }
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = '';
      thresholds = [];
    }
    globalThis.IntersectionObserver = Observer as never;
    const view = render(<LandingAmendmentSectionContentContainer />);
    expect(document.querySelector('[data-motion-started="false"]')).toBeTruthy();
    mocks.observerCallback?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
    expect(mocks.observerDisconnect).not.toHaveBeenCalled();
    mocks.observerCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
    await waitFor(() =>
      expect(document.querySelector('[data-motion-started="true"]')).toBeTruthy()
    );
    expect(mocks.observerDisconnect).toHaveBeenCalled();
    view.unmount();
  });

  it('forwards network state and covers minimap color and direction alternatives', () => {
    render(<LandingNetworkFlowPreview />);
    const props = mocks.flowProps!;
    const miniMap = props.miniMapProps as Record<string, any>;
    expect(miniMap.nodeColor({ data: { kind: 'event' } })).toContain('TealColor');
    expect(miniMap.nodeColor({ data: { kind: 'group' }, style: { background: 'purple' } })).toBe(
      'purple'
    );
    expect(miniMap.nodeColor({ data: { kind: 'group' } })).toContain('NeutralColor');
    expect(miniMap.nodeStrokeColor({ data: { kind: 'event' } })).toContain('TealColor');
    expect(miniMap.nodeStrokeColor({ data: { kind: 'group' } })).toContain('NeutralColorBeta');
    fireEvent.click(screen.getByText('incoming'));
    fireEvent.click(screen.getByText('outgoing'));
    fireEvent.click(screen.getByText('interactive'));
    expect(mocks.toggleDirection).toHaveBeenCalledWith('incoming');
    expect(mocks.toggleDirection).toHaveBeenCalledWith('outgoing');
    const translate = mocks.networkStateOptions?.translateRelationship as (
      key: string,
      fallback?: string
    ) => string;
    expect(translate('key', 'fallback')).toBe('fallback');
    expect(translate('key')).toBe('key');
    expect(
      (mocks.panelProps!.connectionDirectionFilters as any[]).map(item => item.active)
    ).toEqual([true, false]);
  });
});

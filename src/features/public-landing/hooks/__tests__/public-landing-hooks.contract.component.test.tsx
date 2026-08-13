/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useHomePageController } from '../useHomePageController';
import { useLandingAmendmentPreviewData } from '../useLandingAmendmentPreviewData';
import { useLandingNetworkPreviewState } from '../useLandingNetworkPreviewState';

const mocks = vi.hoisted(() => ({
  auth: {
    user: null as null | { id: string; email: string },
    refreshAuthState: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  },
  zeroReady: false,
  currentUser: null as null | { first_name?: string | null },
  translations: {
    paragraphs: ['Opening', 'Process', 'Decision'],
  },
  relationshipData: vi.fn((edge: any, translate: any) => ({
    id: edge.id,
    label: translate('relationship.label'),
  })),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('@/providers/zero-ready-context', () => ({
  useZeroReady: () => mocks.zeroReady,
}));

vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ currentUser: mocks.currentUser }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => `translated:${key}`,
  useTranslation: () => ({
    t: (key: string) => `translated:${key}`,
    tArray: () => mocks.translations.paragraphs,
  }),
}));

vi.mock('@/features/network/logic/networkEdgeHelpers', async importOriginal => {
  const original = await importOriginal<any>();
  return {
    ...original,
    buildNetworkRelationshipDialogData: mocks.relationshipData,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = null;
  mocks.zeroReady = false;
  mocks.currentUser = null;
  mocks.translations.paragraphs = ['Opening', 'Process', 'Decision'];
  sessionStorage.clear();
});

describe('public landing hooks', () => {
  it('models auth readiness, onboarding persistence, completion, and redirect states', async () => {
    const loading = renderHook(() => useHomePageController());
    expect(loading.result.current).toEqual({
      kind: 'loading',
      onRetry: mocks.auth.refreshAuthState,
      onSignOut: mocks.auth.signOut,
    });

    await act(async () => {
      await (loading.result.current as any).onRetry();
      await (loading.result.current as any).onSignOut();
    });
    expect(mocks.auth.refreshAuthState).toHaveBeenCalledOnce();
    expect(mocks.auth.signOut).toHaveBeenCalledOnce();

    loading.unmount();
    mocks.auth.user = { id: 'user-1', email: 'user@example.test' };
    mocks.zeroReady = true;
    sessionStorage.setItem('polity_onboarding', 'true');

    const onboarding = renderHook(() => useHomePageController());
    expect(onboarding.result.current).toMatchObject({
      kind: 'onboarding',
      userId: 'user-1',
      userEmail: 'user@example.test',
    });
    act(() => (onboarding.result.current as any).onComplete());
    expect(sessionStorage.getItem('polity_onboarding')).toBeNull();

    onboarding.unmount();
    mocks.currentUser = { first_name: 'Ada' };
    const redirect = renderHook(() => useHomePageController());
    expect(redirect.result.current).toEqual({ kind: 'redirect' });
  });

  it('builds localized amendment preview data including document, changes, and agenda linkage', () => {
    const { result } = renderHook(() => useLandingAmendmentPreviewData());

    expect(result.current.documentValue[0]).toEqual(
      expect.objectContaining({ children: [{ text: expect.stringContaining('documentTitle') }] })
    );
    expect(result.current.changeRequests).toHaveLength(2);
    expect(result.current.discussions).toHaveLength(2);
    expect(result.current.timelineItems).toHaveLength(2);
    expect(result.current.diffMap['cr-reporting-milestones']).toMatchObject({
      originalText: expect.stringContaining('removed'),
      newText: expect.stringContaining('added'),
    });
    expect(result.current.agendaItemId).toBe('agenda-item-climate-budget-18');
  });

  it('filters preview relationships and exposes deterministic node and edge dialog interactions', () => {
    const groupNode: any = {
      id: 'group-1',
      position: { x: 0, y: 0 },
      data: { kind: 'group', label: 'Group' },
    };
    const eventNode: any = {
      id: 'event-1',
      position: { x: 1, y: 1 },
      data: { kind: 'event', label: 'Event', event: { id: 'event-1', title: 'Event' } },
    };
    const edge: any = {
      id: 'edge-1',
      source: 'group-1',
      target: 'event-1',
      data: {
        rights: ['informationRight'],
        rightEdgeDirections: { informationRight: 'forward' },
        rightConnectionDirections: { informationRight: 'outgoing' },
      },
    };
    const translateRelationship = vi.fn((key: string) => `translated:${key}`);
    const { result } = renderHook(() =>
      useLandingNetworkPreviewState({
        nodes: [groupNode, eventNode],
        edges: [edge],
        alwaysVisibleNodeIds: ['group-1'],
        translateRelationship,
      })
    );

    expect(result.current.visibleEdges).toHaveLength(1);
    expect(result.current.visibleNodes.map(node => node.id)).toEqual(['group-1', 'event-1']);

    act(() => result.current.toggleRight('informationRight'));
    expect(result.current.visibleEdges).toHaveLength(0);
    expect(result.current.visibleNodes.map(node => node.id)).toEqual(['group-1']);
    act(() => result.current.toggleRight('informationRight'));

    act(() => result.current.toggleConnectionDirection('incoming'));
    expect(result.current.selectedConnectionDirections).toEqual(new Set(['outgoing']));
    act(() => result.current.toggleConnectionDirection('outgoing'));
    expect(result.current.selectedConnectionDirections).toEqual(new Set(['incoming', 'outgoing']));

    act(() => result.current.onNodeClick({} as any, groupNode));
    expect(result.current.dialogOpen).toBe(false);
    act(() => result.current.onNodeClick({} as any, eventNode));
    expect(result.current.selectedEntity).toEqual({ type: 'event', data: eventNode.data.event });
    expect(result.current.dialogOpen).toBe(true);

    act(() => result.current.setDialogOpen(false));
    act(() => result.current.onEdgeClick({} as any, edge));
    expect(result.current.selectedEntity).toEqual({
      type: 'relationship',
      data: { id: 'edge-1', label: 'translated:relationship.label' },
    });
    expect(result.current.dialogOpen).toBe(true);

    act(() => {
      result.current.setPanelCollapsed(false);
      result.current.setLegendCollapsed(false);
    });
    expect(result.current.panelCollapsed).toBe(false);
    expect(result.current.legendCollapsed).toBe(false);
  });
});

/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryResults: new Map<string, [unknown, { type: string }]>(),
  search: {} as Record<string, any>,
  relationshipData: { id: 'relationship' },
}));

vi.mock('@/features/shared/ui/status', () => ({ RIGHT_TYPES: ['read', 'write'] }));
vi.mock('@/features/network/logic/networkFilterHelpers', () => ({
  filterEdgesByRights: (edges: unknown[]) => edges,
  filterEdgesByConnectionDirections: (edges: unknown[]) => edges,
  filterNodesByEdges: (nodes: unknown[]) => nodes,
}));
vi.mock('@/features/network/logic/networkEdgeHelpers', () => ({
  buildNetworkRelationshipDialogData: () => mocks.relationshipData,
}));
vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { key?: string } | undefined) =>
    query?.key ? mocks.queryResults.get(query.key)! : [undefined, { type: 'complete' }],
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    users: { byId: () => ({ key: 'user' }) },
    common: { userHashtags: () => ({ key: 'hashtags' }) },
  },
}));
vi.mock('@tanstack/react-router', () => ({ useSearch: () => mocks.search }));
vi.mock('@/features/agendas/logic/createMockCRTimelineItems', () => ({
  createMockCRTimelineItems: () => [
    { id: 'with-vote', vote: { choices: [{ label: 'yes' }, { label: 'abstain' }] } },
    { id: 'without-vote', vote: null },
  ],
}));

import { useLandingNetworkPreviewState } from '../useLandingNetworkPreviewState';
import { buildLandingAmendmentPreviewData } from '../../logic/landingAmendmentPreview';
import { useUserData } from '@/features/users/hooks/useUserData';
import { useUserWikiContentSearch } from '@/features/users/state/useUserWikiContentSearch';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryResults = new Map([
    ['user', [{ id: 'u1' }, { type: 'complete' }]],
    ['hashtags', [undefined, { type: 'complete' }]],
  ]);
  mocks.search = {};
});

describe('landing and user hook/logic branches A07', () => {
  it('toggles rights and every connection-direction state and opens valid entities only', () => {
    const nodes = [{ id: 'n1' }] as never;
    const edges = [{ id: 'e1' }] as never;
    const hook = renderHook(() =>
      useLandingNetworkPreviewState({
        nodes,
        edges,
        alwaysVisibleNodeIds: [],
        translateRelationship: key => key,
      })
    );
    act(() => hook.result.current.toggleRight('read'));
    expect(hook.result.current.selectedRights.has('read')).toBe(false);
    act(() => hook.result.current.toggleRight('custom'));
    expect(hook.result.current.selectedRights.has('custom')).toBe(true);

    act(() => hook.result.current.toggleConnectionDirection('incoming'));
    expect(hook.result.current.selectedConnectionDirections.has('incoming')).toBe(false);
    act(() => hook.result.current.toggleConnectionDirection('incoming'));
    act(() => hook.result.current.toggleConnectionDirection('outgoing'));
    expect([...hook.result.current.selectedConnectionDirections]).toEqual(['incoming']);
    act(() => hook.result.current.toggleConnectionDirection('incoming'));
    expect([...hook.result.current.selectedConnectionDirections].sort()).toEqual([
      'incoming',
      'outgoing',
    ]);

    act(() => hook.result.current.onNodeClick({} as never, { data: undefined } as never));
    act(() => hook.result.current.onNodeClick({} as never, { data: { kind: 'group' } } as never));
    act(() => hook.result.current.onNodeClick({} as never, { data: { kind: 'event' } } as never));
    expect(hook.result.current.dialogOpen).toBe(false);
    act(() =>
      hook.result.current.onNodeClick(
        {} as never,
        { data: { kind: 'event', event: { id: 'event' } } } as never
      )
    );
    expect(hook.result.current.selectedEntity).toMatchObject({ type: 'event' });
    act(() => hook.result.current.onEdgeClick({} as never, { id: 'edge' } as never));
    expect(hook.result.current.selectedEntity).toEqual({
      type: 'relationship',
      data: mocks.relationshipData,
    });
  });

  it('builds amendment previews with populated/default paragraphs and vote/no-vote rows', () => {
    const base = {
      documentTitle: 'Doc',
      paragraphs: ['Open', 'Process', 'Decision'],
      changeRequestTitle: 'CR',
      changeRequestSubtitle: 'Sub',
      removedText: 'old',
      addedText: 'new',
      eventTitle: 'Event',
      eventDescription: 'Desc',
      workflowDescription: 'Why',
    };
    const full = buildLandingAmendmentPreviewData(base);
    expect(full.timelineItems[0].vote?.choices).toHaveLength(1);
    expect(full.timelineItems[1].vote).toBeNull();
    expect(JSON.stringify(full.documentValue)).toContain('Process ');
    const defaults = buildLandingAmendmentPreviewData({ ...base, paragraphs: [] });
    expect(JSON.stringify(defaults.documentValue)).not.toContain('Process ');
    expect(defaults.discussions.map(item => item.userId)).toEqual([
      'landing-policy-lead',
      'landing-reviewer',
    ]);
  });

  it('resolves user loading/missing/hashtags alternatives', () => {
    const absent = renderHook(() => useUserData(undefined));
    expect(absent.result.current).toMatchObject({ user: null, isLoading: false });

    mocks.queryResults.set('user', [{ id: 'u1' }, { type: 'unknown' }]);
    const loading = renderHook(() => useUserData('u1'));
    expect(loading.result.current.isLoading).toBe(true);
    mocks.queryResults.set('user', [undefined, { type: 'complete' }]);
    loading.rerender();
    expect(loading.result.current.user).toBeNull();
    mocks.queryResults.set('user', [{ id: 'u1' }, { type: 'complete' }]);
    loading.rerender();
    expect(loading.result.current.user?.user_hashtags).toEqual([]);
    mocks.queryResults.set('hashtags', [[{ hashtag: { name: 'x' } }], { type: 'complete' }]);
    loading.rerender();
    expect(loading.result.current.user?.user_hashtags).toHaveLength(1);
  });

  it('initializes, adds and removes URL-backed wiki searches', () => {
    mocks.search = { all: 'all', blogs: null, keep: 'yes' };
    const replace = vi.spyOn(window.history, 'replaceState');
    const hook = renderHook(() => useUserWikiContentSearch());
    expect(hook.result.current.searchTerms).toMatchObject({ all: 'all', blogs: '' });
    act(() => hook.result.current.handleSearchChange('groups', 'council'));
    expect(replace.mock.calls.at(-1)?.[2]).toContain('?all=all&keep=yes&groups=council');
    act(() => hook.result.current.handleSearchChange('all', ''));
    expect(replace.mock.calls.at(-1)?.[2]).toContain('?keep=yes');
    mocks.search = {};
    const empty = renderHook(() => useUserWikiContentSearch());
    act(() => empty.result.current.handleSearchChange('all', ''));
    expect(replace.mock.calls.at(-1)?.[2]).not.toContain('?');
  });
});

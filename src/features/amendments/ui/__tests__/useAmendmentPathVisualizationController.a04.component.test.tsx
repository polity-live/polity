/* @vitest-environment jsdom */

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  amendment: null as any,
  t: (key: string) => `t:${key}`,
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({ amendmentPathViz: mocks.amendment }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: mocks.t }),
  translate: (key: string) => `t:${key}`,
}));
vi.mock('@/features/network/logic/networkEdgeHelpers', () => ({
  getCivicNetworkEdgeStyle: (value: any) => ({ edgeStyle: value.color }),
  getCivicNetworkLabelStyle: (value: any) => ({ labelStyle: value.color }),
}));
vi.mock('@/features/network/ui/networkVisualHelpers', () => ({
  getGroupNodeStyle: (variant: string, style: any) => ({ ...style, variant }),
  getGroupNodeVisualTokens: () => ({ borderColor: 'blue' }),
}));

import { useAmendmentPathVisualizationController } from '../useAmendmentPathVisualizationController';

describe('useAmendmentPathVisualizationController A04 branch accountability', () => {
  beforeEach(() => {
    mocks.amendment = null;
  });
  afterEach(() => cleanup());

  it('returns an empty visualization without amendment path data', async () => {
    const { result, rerender } = renderHook(() =>
      useAmendmentPathVisualizationController({ amendmentId: 'amendment' })
    );
    await waitFor(() => expect(result.current.nodes).toEqual([]));
    expect(result.current.edges).toEqual([]);
    expect(result.current.pathSegments).toEqual([]);
    expect(result.current.hasTarget).toBeUndefined();

    mocks.amendment = { group: { id: 'group' }, event: null, paths: [] };
    rerender();
    expect(result.current.hasTarget).toBeNull();
  });

  it('sorts segments and creates current, parent, and target nodes plus edges', async () => {
    mocks.amendment = {
      group: { id: 'group' },
      event: { id: 'event' },
      paths: [
        {
          segments: [
            { order_index: 2, group_id: null, event_id: null },
            { order_index: null, group_id: 'first', event_id: 'first-event' },
            { order_index: 1, group_id: 'middle', event_id: null },
          ],
        },
      ],
    };
    const { result } = renderHook(() =>
      useAmendmentPathVisualizationController({ amendmentId: 'amendment' })
    );

    await waitFor(() => expect(result.current.nodes).toHaveLength(3));
    expect(result.current.hasTarget).toEqual({ id: 'event' });
    expect(result.current.pathSegments.map((segment: any) => segment.group_id)).toEqual([
      'first',
      'middle',
      null,
    ]);
    expect(result.current.nodes.map(node => (node.style as any).variant)).toEqual([
      'current',
      'parent',
      'child',
    ]);
    expect(result.current.nodes[1].data.event).toContain('noEvent');
    expect(result.current.nodes[2].data.label).toContain('unknownGroup');
    expect(result.current.edges).toHaveLength(2);
    expect(result.current.edges[0]).toEqual(
      expect.objectContaining({ source: 'path-node-0', target: 'path-node-1' })
    );
  });

  it('handles a single segment and missing nested segment arrays', async () => {
    mocks.amendment = { group: null, event: { id: 'event' }, paths: [{ segments: undefined }] };
    const { result, rerender } = renderHook(() =>
      useAmendmentPathVisualizationController({ amendmentId: 'amendment' })
    );
    await waitFor(() => expect(result.current.nodes).toEqual([]));

    mocks.amendment = {
      group: { id: 'group' },
      event: { id: 'event' },
      paths: [{ segments: [{ order_index: 4, group_id: 'only', event_id: 'event' }] }],
    };
    rerender();
    await waitFor(() => expect(result.current.nodes).toHaveLength(1));
    expect((result.current.nodes[0].style as any).variant).toBe('current');
    expect(result.current.edges).toEqual([]);
  });
});

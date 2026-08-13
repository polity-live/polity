/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useNetworkFlowControls } from '../useNetworkFlowControls';

describe('useNetworkFlowControls', () => {
  it('adapts depth, status, direction, right, and interactive controls', () => {
    const { result } = renderHook(() => useNetworkFlowControls());
    expect(result.current.relationshipDepthFilter).toBe('all');
    expect(result.current.showIndirect).toBe(true);

    act(() => result.current.setShowIndirect(false));
    expect(result.current.relationshipDepthFilter).toBe('direct');
    expect(result.current.showIndirect).toBe(false);
    act(() => result.current.setShowIndirect(true));
    expect(result.current.relationshipDepthFilter).toBe('all');

    for (const [kinds, expected] of [
      [new Set(['active']), 'active'],
      [new Set(['incoming']), 'incoming'],
      [new Set(['outgoing']), 'outgoing'],
      [new Set(), 'active'],
    ] as const) {
      act(() => result.current.setSelectedRelationshipKinds(kinds as never));
      expect(result.current.relationshipStatusFilter).toBe(expected);
      expect([...result.current.selectedRelationshipKinds]).toEqual([expected]);
    }

    for (const [directions, expected] of [
      [new Set(['incoming', 'outgoing']), 'all'],
      [new Set(['incoming']), 'incoming'],
      [new Set(['outgoing']), 'outgoing'],
      [new Set(), 'all'],
    ] as const) {
      act(() => result.current.setSelectedConnectionDirections(directions as never));
      expect(result.current.connectionDirectionFilter).toBe(expected);
    }
    expect([...result.current.selectedConnectionDirections]).toEqual(['incoming', 'outgoing']);

    act(() => result.current.setConnectionDirectionFilter('incoming'));
    expect([...result.current.selectedConnectionDirections]).toEqual(['incoming']);
    act(() => result.current.setConnectionDirectionFilter('outgoing'));
    expect([...result.current.selectedConnectionDirections]).toEqual(['outgoing']);

    act(() => result.current.toggleRight('informationRight'));
    expect(result.current.selectedRights.has('informationRight')).toBe(false);
    act(() => result.current.toggleRight('informationRight'));
    expect(result.current.selectedRights.has('informationRight')).toBe(true);

    act(() => result.current.toggleRelationshipKind('incoming'));
    expect(result.current.relationshipStatusFilter).toBe('incoming');
    act(() => result.current.toggleRelationshipKind('incoming'));
    expect(result.current.relationshipStatusFilter).toBe('active');

    act(() => result.current.toggleConnectionDirection('incoming'));
    expect(result.current.connectionDirectionFilter).toBe('incoming');
    act(() => result.current.toggleConnectionDirection('incoming'));
    expect(result.current.connectionDirectionFilter).toBe('all');

    act(() => result.current.setSelectedNodes(['node']));
    act(() => result.current.handleInteractiveChange(true));
    expect(result.current.selectedNodes).toEqual(['node']);
    act(() => result.current.handleInteractiveChange(false));
    expect(result.current.isInteractive).toBe(false);
    expect(result.current.selectedNodes).toEqual([]);
  });
});

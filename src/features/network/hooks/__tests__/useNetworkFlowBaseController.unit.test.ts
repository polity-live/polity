/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useNetworkFlowBaseController } from '../useNetworkFlowBaseController';

describe('useNetworkFlowBaseController', () => {
  it('forwards edge-label clicks and manages fullscreen escape/cleanup', () => {
    const onEdgeClick = vi.fn();
    const edges = [{ id: 'edge-a' }, { id: 'edge-b' }] as never[];
    const { result, rerender, unmount } = renderHook(
      props => useNetworkFlowBaseController(props as never),
      { initialProps: { edges, onEdgeClick: undefined as any } }
    );
    act(() => result.current.handleEdgeLabelClick('edge-a'));
    expect(onEdgeClick).not.toHaveBeenCalled();

    rerender({ edges, onEdgeClick });
    act(() => result.current.handleEdgeLabelClick('missing'));
    expect(onEdgeClick).not.toHaveBeenCalled();
    act(() => result.current.handleEdgeLabelClick('edge-a'));
    expect(onEdgeClick).toHaveBeenCalledWith(expect.any(MouseEvent), edges[0]);

    document.body.style.overflow = 'scroll';
    act(() => result.current.setIsFullscreen(true));
    expect(document.body.style.overflow).toBe('hidden');
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })));
    expect(result.current.isFullscreen).toBe(true);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(result.current.isFullscreen).toBe(false);
    expect(document.body.style.overflow).toBe('scroll');

    act(() => result.current.setIsFullscreen(true));
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });
});

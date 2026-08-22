/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNetworkViewportPanelController } from '../useNetworkViewportPanelController';

describe('useNetworkViewportPanelController', () => {
  let observerCallback: () => void;
  const observe = vi.fn();
  const disconnect = vi.fn();
  const visualAdd = vi.fn();
  const visualRemove = vi.fn();

  beforeEach(() => {
    observe.mockReset();
    disconnect.mockReset();
    visualAdd.mockReset();
    visualRemove.mockReset();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          observerCallback = callback;
        }
        observe = observe;
        disconnect = disconnect;
      }
    );
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback(1);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  it('measures viewport space, observes parents, and cleans up listeners', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: { height: 900, addEventListener: visualAdd, removeEventListener: visualRemove },
    });
    const noBorderAncestor = document.createElement('main');
    const grandparent = document.createElement('article');
    const parent = document.createElement('section');
    const element = document.createElement('div');
    parent.appendChild(element);
    grandparent.appendChild(parent);
    noBorderAncestor.appendChild(grandparent);
    document.body.appendChild(noBorderAncestor);
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ top: -20 } as DOMRect);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      currentElement =>
        (currentElement === parent
          ? {
              paddingBottom: '10px',
              marginBottom: 'invalid',
              borderBottomStyle: 'solid',
              borderBottomWidth: '2px',
            }
          : currentElement === grandparent
            ? {
                paddingBottom: 'invalid',
                marginBottom: '0px',
                borderBottomStyle: 'dashed',
                borderBottomWidth: 'invalid',
              }
            : {
                paddingBottom: 'invalid',
                marginBottom: '0px',
                borderBottomStyle: 'none',
                borderBottomWidth: 'invalid',
              }) as CSSStyleDeclaration
    );

    const { result, rerender, unmount } = renderHook(
      ({ minHeight }) => useNetworkViewportPanelController(minHeight),
      { initialProps: { minHeight: 300 } }
    );
    expect(result.current.height).toBe(300);
    result.current.containerRef.current = element;
    rerender({ minHeight: 301 });
    act(() => observerCallback());
    expect(result.current.height).toBe(887);
    expect(observe).toHaveBeenCalledWith(element);
    expect(observe).toHaveBeenCalledWith(parent);

    act(() => observerCallback());
    expect(result.current.height).toBe(887);
    rerender({ minHeight: 1000 });
    result.current.containerRef.current = element;
    act(() => observerCallback());
    expect(result.current.height).toBe(1000);
    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(visualRemove).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('falls back to innerHeight and handles an element without a parent', () => {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 });
    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect);
    const { result, rerender, unmount } = renderHook(
      ({ minHeight }) => useNetworkViewportPanelController(minHeight),
      { initialProps: { minHeight: 200 } }
    );
    result.current.containerRef.current = element;
    rerender({ minHeight: 201 });
    act(() => observerCallback());
    expect(result.current.height).toBe(599);
    unmount();
  });
});

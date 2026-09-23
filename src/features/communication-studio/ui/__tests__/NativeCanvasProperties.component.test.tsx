/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { NativeCanvasProperties } from '../NativeCanvasProperties';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const text = {
  id: 'test-text',
  type: 'text',
  x: 0,
  y: 0,
  width: 200,
  height: 40,
  angle: 0,
  opacity: 100,
  strokeWidth: 1,
  roughness: 0,
  fillStyle: 'solid',
  strokeStyle: 'solid',
  strokeColor: '#1b1b1f',
  backgroundColor: '#ffffff',
  fontSize: 24,
  groupIds: [],
  boundElements: null,
  locked: false,
} as unknown as ExcalidrawElement;

it('names detail controls and shows matching tooltips on focus and hover', async () => {
  const patch = vi.fn();
  const format = vi.fn();
  render(
    <NativeCanvasProperties
      elements={[text]}
      disabled={false}
      patch={patch}
      action={vi.fn()}
      format={format}
      canFormat
      de={false}
    />
  );
  const bold = screen.getByRole('button', { name: 'bold' });
  bold.focus();
  expect((await screen.findByRole('tooltip')).textContent).toContain('bold');
  fireEvent.click(bold);
  expect(format).toHaveBeenCalledWith('bold');
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  const swatch = screen.getByRole('button', { name: 'Fill #e03131' });
  fireEvent.pointerMove(swatch, { pointerType: 'mouse' });
  expect((await screen.findByRole('tooltip')).textContent).toContain('Fill #e03131');
  fireEvent.click(swatch);
  expect(patch).toHaveBeenCalledWith({ backgroundColor: '#e03131' });
  expect(screen.getByRole('button', { name: 'Send backward' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Cross-hatch' })).toBeTruthy();
});

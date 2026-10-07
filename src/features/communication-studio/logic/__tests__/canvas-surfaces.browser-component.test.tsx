import { expect, it } from 'vitest';
import { configureStudioCanvasSurfaces } from '../canvas-surfaces';

it('tolerates surfaces that have not been mounted or have already been removed', () => {
  expect(() =>
    configureStudioCanvasSurfaces({ editable: true, contain: false, editingText: false })
  ).not.toThrow();
});

it.each(['editable', 'readonly', 'contain', 'text editing'] as const)(
  'configures actual browser canvases for %s interaction',
  mode => {
    const lower = document.createElement('canvas');
    const controls = document.createElement('canvas');
    const upper = mode === 'text editing' ? document.createElement('canvas') : undefined;
    const editable = mode !== 'readonly';
    const contain = mode === 'contain';
    const editingText = mode === 'text editing';
    configureStudioCanvasSurfaces({ lower, upper, controls, editable, contain, editingText });
    const touchAction = editable && !contain ? 'none' : '';
    expect(lower.style.touchAction).toBe(touchAction);
    expect(controls.style.touchAction).toBe(touchAction);
    expect(lower.style.zIndex).toBe('0');
    expect(controls.style.zIndex).toBe('3');
    expect(controls.style.pointerEvents).toBe(editingText ? 'none' : 'auto');
    if (upper) {
      expect(upper.style.touchAction).toBe('none');
      expect(upper.style.zIndex).toBe('2');
      expect(upper.style.pointerEvents).toBe('none');
    }
  }
);

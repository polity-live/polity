import Konva from 'konva';
import { expect, it } from 'vitest';
import { observeStudioCanvasContent } from '../canvas-content';

it('waits for SDK content before subscribing and removes the native subscription on cleanup', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const stage = new Konva.Stage({ container, width: 100, height: 100 });
  let gestures = 0;
  const observe = (content: HTMLDivElement) => {
    expect(content).toBe(stage.content);
    const listener = () => {
      gestures++;
    };
    content.addEventListener('touchstart', listener);
    return () => content.removeEventListener('touchstart', listener);
  };
  try {
    expect(observeStudioCanvasContent(null, observe)).toBeUndefined();
    expect(gestures).toBe(0);
    const cleanup = observeStudioCanvasContent(stage, observe);
    const touch = new Touch({ identifier: 1, target: stage.content, clientX: 10, clientY: 10 });
    stage.content.dispatchEvent(
      new TouchEvent('touchstart', { touches: [touch], changedTouches: [touch] })
    );
    expect(gestures).toBe(1);
    cleanup?.();
    stage.content.dispatchEvent(
      new TouchEvent('touchstart', { touches: [touch], changedTouches: [touch] })
    );
    expect(gestures).toBe(1);
  } finally {
    stage.destroy();
    container.remove();
  }
});

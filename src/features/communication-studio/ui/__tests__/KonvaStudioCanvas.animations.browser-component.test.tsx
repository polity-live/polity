import Konva from 'konva';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { cdp } from 'vitest/browser';
import { createFrameNode, createStudioDocumentV5 } from '../../logic/document-v3';
import { createStudioNodeFromElement } from '../../logic/create-studio-node';
import { element } from '../../logic/document';
import KonvaStudioCanvas from '../KonvaStudioCanvas';

afterEach(async () => {
  await cdp().send('Emulation.setEmulatedMedia', { features: [] });
  vi.restoreAllMocks();
});

function fixture() {
  const document = createStudioDocumentV5('Presentation animation');
  const frame = createFrameNode('custom', {
    transform: { x: 0, y: 0, width: 640, height: 400 },
    intro: { mode: 'static', assetId: null, intensity: 0.45 },
  });
  const nodes = (['pulse', 'slide', 'fade', 'stagger'] as const).map((preset, index) => {
    const node = createStudioNodeFromElement(
      element('rect', { x: 30 + index * 120, y: 30, width: 80, height: 80 }),
      frame.id,
      index
    );
    node.showAnimation = { preset, duration: 0.2, intensity: 0.8 };
    return node;
  });
  const other = createFrameNode('custom', {
    transform: { x: 1000, y: 0, width: 640, height: 400 },
  });
  const hiddenFrameNode = structuredClone(nodes[0]);
  hiddenFrameNode.id = crypto.randomUUID();
  hiddenFrameNode.parentFrameId = other.id;
  document.nodes.push(frame, ...nodes, other, hiddenFrameNode);
  return { document, frame, nodes };
}

function stage() {
  const host = screen.getByTestId('studio-canvas');
  return Konva.stages.find(stage => host.contains(stage.container()))!;
}

it('plays entering tweens and pulse animation, then cancels animation frames on unmount', async () => {
  const { document, frame, nodes } = fixture();
  const cancel = vi.spyOn(window, 'cancelAnimationFrame');
  const view = render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={document}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable={false}
        fit="contain"
        showCue="enter"
      />
    </div>
  );
  await waitFor(() =>
    expect(stage().findOne(`#${nodes[0].id}-show`)?.opacity()).toBeLessThan(0.999)
  );
  await waitFor(() => expect(stage().findOne(`#${nodes[2].id}-show`)?.opacity()).toBe(1));
  await waitFor(() => expect(stage().findOne(`#${nodes[3].id}-show`)?.x()).toBe(0));
  view.unmount();
  expect(cancel).toHaveBeenCalled();
  expect(Konva.stages.some(stage => stage.findOne(`#${nodes[0].id}-show`))).toBe(false);
});

it('renders deterministic paused animation positions and respects reduced motion', async () => {
  const { document, frame, nodes } = fixture();
  const canvas = () => (
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={document}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable={false}
        fit="contain"
        showCue="enter"
        showPosition={0.1}
      />
    </div>
  );
  const view = render(canvas());
  await waitFor(() => expect(stage().findOne(`#${nodes[1].id}-show`)?.x()).toBeCloseTo(8));
  expect(stage().findOne(`#${nodes[0].id}-show`)?.opacity()).toBeCloseTo(0.8);
  expect(stage().findOne(`#${nodes[2].id}-show`)?.opacity()).toBeCloseTo(0.875);
  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  view.unmount();
  render(canvas());
  await waitFor(() => expect(stage().findOne(`#${nodes[0].id}-show`)?.opacity()).toBe(1));
  expect(stage().findOne(`#${nodes[1].id}-show`)?.x()).toBe(0);
});

it('keeps node animations at their final positions while the frame owns a spatial intro', async () => {
  const { document, frame, nodes } = fixture();
  frame.intro = { mode: 'spatial', assetId: null, intensity: 0.45 };
  render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={document}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable={false}
        fit="contain"
        showCue="enter"
        showPosition={0.1}
      />
    </div>
  );
  await waitFor(() => expect(stage().findOne(`#${nodes[0].id}-show`)?.opacity()).toBe(1));
  expect(stage().findOne(`#${nodes[1].id}-show`)?.x()).toBe(0);
  expect(stage().findOne(`#${nodes[2].id}-show`)?.opacity()).toBe(1);
});

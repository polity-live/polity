import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { defaultBrand } from '../../logic/document';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import { diffStudio } from '../../logic/operations';
import { buildProposalAnnotations } from '../../logic/change-request-annotations';
import type { CanvasProposal } from '../../logic/governance';
import KonvaStudioCanvas from '../KonvaStudioCanvas';

it('shows green additions and struck red removals and keeps their outlines aligned during pan and zoom', async () => {
  const original = createStudioTemplateDocumentV5('single', 'Change preview', defaultBrand);
  const frame = original.nodes.find(node => node.type === 'frame')!;
  const removed = original.nodes.find(node => node.type === 'shape')!;
  const proposed = structuredClone(original);
  proposed.nodes = proposed.nodes.filter(node => node.id !== removed.id);
  const added = structuredClone(removed);
  added.id = crypto.randomUUID();
  added.transform = { ...added.transform, x: 300, y: 220, width: 80, height: 60 };
  proposed.nodes.push(added);
  const addedFrame = structuredClone(frame);
  addedFrame.id = crypto.randomUUID();
  addedFrame.transform = {
    ...addedFrame.transform,
    x: frame.transform.x + 150,
    y: frame.transform.y + 80,
    width: 120,
    height: 100,
  };
  proposed.nodes.push(addedFrame);
  const changes = diffStudio(original, proposed);
  const proposal = {
    id: 'request',
    title: 'Canvas changes',
    changes,
  } as CanvasProposal;
  const onSelect = vi.fn();
  const annotations = (document: typeof original) =>
    buildProposalAnnotations({
      proposal,
      changes,
      canonicalDocument: original,
      displayedDocument: document,
      selected: true,
    });
  const view = render(
    <div style={{ width: 1000, height: 700 }}>
      <KonvaStudioCanvas
        document={original}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable
        changeRequestMarkers={annotations(original)}
        onChangeRequestSelect={onSelect}
      />
    </div>
  );
  const addOutline = await screen.findByTestId(`studio-change-outline-request:${added.id}`);
  const addedFrameOutline = await screen.findByTestId(
    `studio-change-outline-request:${addedFrame.id}`
  );
  const removeOutline = await screen.findByTestId(`studio-change-outline-request:${removed.id}`);
  await waitFor(() => expect(Number.parseFloat(addOutline.style.width)).toBeGreaterThan(0));
  expect(addOutline.dataset.changeRequestTone).toBe('add');
  expect(addOutline.style.border).toContain('--badge-success-border');
  expect(addOutline.style.boxShadow).toContain('--badge-success-border');
  expect(addedFrameOutline.dataset.changeRequestTone).toBe('add');
  expect(addOutline.dataset.changeRequestGhost).toBe('true');
  expect(removeOutline.dataset.changeRequestTone).toBe('remove');
  expect(removeOutline.dataset.changeRequestGhost).toBe('false');
  expect(
    screen.getByTestId(`studio-change-strike-request:${removed.id}`).style.borderTop
  ).toContain('3px');
  fireEvent.click(addOutline.querySelector('button')!);
  expect(onSelect).toHaveBeenCalledWith('request');

  const surface = screen.getByTestId('studio-canvas').querySelector<HTMLCanvasElement>('canvas')!;
  const bounds = surface.getBoundingClientRect();
  const leftBeforePan = Number.parseFloat(addOutline.style.left);
  fireEvent.wheel(surface, {
    deltaX: 40,
    deltaY: 30,
    clientX: bounds.left + 250,
    clientY: bounds.top + 240,
  });
  await waitFor(() =>
    expect(Number.parseFloat(addOutline.style.left)).toBeCloseTo(leftBeforePan - 40, 0)
  );
  const widthBeforeZoom = Number.parseFloat(addOutline.style.width);
  fireEvent.wheel(surface, {
    ctrlKey: true,
    deltaY: -60,
    clientX: bounds.left + 250,
    clientY: bounds.top + 240,
  });
  await waitFor(() =>
    expect(Number.parseFloat(addOutline.style.width)).toBeGreaterThan(widthBeforeZoom)
  );

  view.rerender(
    <div style={{ width: 1000, height: 700 }}>
      <KonvaStudioCanvas
        document={proposed}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable={false}
        changeRequestMarkers={annotations(proposed)}
        onChangeRequestSelect={onSelect}
      />
    </div>
  );
  expect(addOutline.dataset.changeRequestGhost).toBe('false');
  expect(removeOutline.dataset.changeRequestGhost).toBe('true');
  expect(getComputedStyle(removeOutline).borderTopColor).toBeTruthy();
});

import { createRef } from 'react';
import Konva from 'konva';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defaultBrand, element } from '../../logic/document';
import { createStudioNodeFromElement } from '../../logic/create-studio-node';
import { paintStudioDocumentFrame } from '../../logic/paint-v5';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import KonvaStudioCanvas, { type StudioCanvasHandle } from '../KonvaStudioCanvas';

const source = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="100" height="100" fill="red"/><rect x="100" width="100" height="100" fill="blue"/></svg>')}`;

function fixture(cropped: boolean) {
  const studio = createStudioTemplateDocumentV5('single', 'Crop', defaultBrand, 1, 'blank');
  const frame = studio.nodes.find(node => node.type === 'frame')!;
  frame.transform = {
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    rotation: 0,
    flipX: false,
    flipY: false,
  };
  frame.style.fill = '#ffffff';
  const assetId = crypto.randomUUID();
  const media = createStudioNodeFromElement(
    element('image', {
      assetId,
      x: 20,
      y: 20,
      width: 100,
      height: 100,
      fit: 'cover',
      crop: cropped
        ? { x: 100, y: 0, width: 100, height: 100, naturalWidth: 200, naturalHeight: 100 }
        : null,
    }),
    frame.id,
    0
  );
  studio.nodes.push(media);
  return {
    studio,
    frame,
    media,
    asset: { id: assetId, name: 'halves.svg', mime: 'image/svg+xml', url: source },
  };
}

function solidColors(canvas: HTMLCanvasElement) {
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  let red = 0,
    blue = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > 220 && pixels[i + 1] < 40 && pixels[i + 2] < 40) red++;
    if (pixels[i + 2] > 220 && pixels[i] < 40 && pixels[i + 1] < 40) blue++;
  }
  return { red, blue };
}

function mediaBounds(canvas: HTMLCanvasElement) {
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width,
    top = canvas.height,
    right = 0,
    bottom = 0;
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const red = pixels[i] > 220 && pixels[i + 1] < 40 && pixels[i + 2] < 40;
      const blue = pixels[i + 2] > 220 && pixels[i] < 40 && pixels[i + 1] < 40;
      if (red || blue) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  return { left, top, right, bottom };
}

function pointerOnMedia(canvas: HTMLCanvasElement, mediaId: string, x: number, y: number) {
  const stage = Konva.stages.find(item => item.container().contains(canvas));
  const node = stage?.findOne(`#${mediaId}`);
  if (!node) throw new Error(`Media ${mediaId} is not on the canvas`);
  const point = node.getAbsoluteTransform(stage).point({ x, y });
  const rect = canvas.getBoundingClientRect();
  return {
    clientX: rect.left + (point.x * rect.width) / canvas.width,
    clientY: rect.top + (point.y * rect.height) / canvas.height,
  };
}

it('shows the same cropped source in Konva preview and PNG rendering', async () => {
  const { studio, frame, media, asset } = fixture(true);
  render(
    <div style={{ width: 500, height: 300 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[asset]}
        selected={[]}
        editable={false}
        fit="contain"
      />
    </div>
  );
  const canvas = screen.getByTestId('studio-canvas').querySelector('canvas')!;
  await waitFor(() => expect(solidColors(canvas).blue).toBeGreaterThan(100));
  expect(solidColors(canvas).red).toBe(0);
  const png = await paintStudioDocumentFrame(studio, frame.id, { [asset.id]: source });
  const image = new Image();
  image.src = png;
  await image.decode();
  const output = document.createElement('canvas');
  output.width = image.width;
  output.height = image.height;
  output.getContext('2d')!.drawImage(image, 0, 0);
  expect(solidColors(output).blue).toBeGreaterThan(100);
  expect(solidColors(output).red).toBe(0);
  expect(media.type).toBe('media');
});

it('applies a crop once and discards an abandoned crop', async () => {
  const { studio, frame, media, asset } = fixture(false);
  const ref = createRef<StudioCanvasHandle>();
  const commit = vi.fn();
  render(
    <div style={{ width: 500, height: 300 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        assets={[asset]}
        selected={[media.id]}
        editable
        fit="contain"
        inspector={<p>Properties</p>}
        onCropCommit={commit}
      />
    </div>
  );
  expect(screen.queryByRole('slider')).toBeNull();
  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  await screen.findByRole('toolbar', { name: 'Crop' });
  expect(screen.queryByRole('complementary', { name: 'Elementeigenschaften' })).toBeNull();
  fireEvent.change(screen.getByRole('slider'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(commit).not.toHaveBeenCalled();
  expect(screen.getByRole('complementary', { name: 'Elementeigenschaften' })).toBeTruthy();
  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  fireEvent.change(screen.getByRole('slider'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit.mock.calls[0][1].crop.width).toBeLessThan(100);
  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  fireEvent.change(screen.getByRole('slider'), { target: { value: '2' } });
  fireEvent.keyDown(screen.getByRole('slider'), { key: 'Escape' });
  expect(screen.queryByRole('toolbar', { name: 'Crop' })).toBeNull();
  expect(commit).toHaveBeenCalledTimes(1);
  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(commit).toHaveBeenCalledTimes(2);
  expect(commit.mock.calls[1][1]).toMatchObject({ fit: 'contain', crop: { x: 0, width: 200 } });
});

it('drags a crop edge on the real canvas and saves the smaller frame', async () => {
  const { studio, frame, media, asset } = fixture(false);
  const ref = createRef<StudioCanvasHandle>();
  const commit = vi.fn();
  render(
    <div style={{ width: 500, height: 300 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        assets={[asset]}
        selected={[media.id]}
        editable
        fit="contain"
        onCropCommit={commit}
      />
    </div>
  );
  const canvases = [...screen.getByTestId('studio-canvas').querySelectorAll('canvas')];
  await waitFor(() => expect(solidColors(canvases[0]).red).toBeGreaterThan(100));
  await waitFor(() => expect(mediaBounds(canvases[0]).right).toBeGreaterThan(50));
  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  const controls = canvases.at(-1)!;
  const { clientX: x, clientY: y } = await waitFor(() => pointerOnMedia(controls, media.id, 3, 50));
  await act(async () => {
    fireEvent.pointerDown(controls, { clientX: x, clientY: y, pointerId: 1, button: 0 });
    fireEvent.pointerMove(controls, { clientX: x + 30, clientY: y, pointerId: 1, button: 0 });
    fireEvent.pointerUp(controls, { clientX: x + 30, clientY: y, pointerId: 1, button: 0 });
  });
  await waitFor(() =>
    expect(
      Number(screen.getByRole('toolbar', { name: 'Crop' }).getAttribute('data-frame-width'))
    ).toBeLessThan(100)
  );
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit.mock.calls[0][1].frame.width).toBeLessThan(100);
  expect(commit.mock.calls[0][1].crop.width).toBeLessThan(100);
});

it('pans a crop on the real canvas within the source bounds', async () => {
  const { studio, frame, media, asset } = fixture(true);
  const ref = createRef<StudioCanvasHandle>();
  const commit = vi.fn();
  render(
    <div style={{ width: 500, height: 300 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        assets={[asset]}
        selected={[media.id]}
        editable
        fit="contain"
        onCropCommit={commit}
      />
    </div>
  );
  const canvases = [...screen.getByTestId('studio-canvas').querySelectorAll('canvas')];
  await waitFor(() => expect(solidColors(canvases[0]).blue).toBeGreaterThan(100));
  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  const controls = canvases.at(-1)!;
  const { clientX: centerX, clientY: centerY } = await waitFor(() =>
    pointerOnMedia(controls, media.id, 50, 50)
  );
  await act(async () => {
    fireEvent.pointerDown(controls, {
      clientX: centerX,
      clientY: centerY,
      pointerId: 2,
      button: 0,
    });
    fireEvent.pointerMove(controls, {
      clientX: centerX + 30,
      clientY: centerY,
      pointerId: 2,
      button: 0,
    });
    fireEvent.pointerUp(controls, {
      clientX: centerX + 30,
      clientY: centerY,
      pointerId: 2,
      button: 0,
    });
  });
  await waitFor(() =>
    expect(
      Number(screen.getByRole('toolbar', { name: 'Crop' }).getAttribute('data-crop-x'))
    ).toBeLessThan(100)
  );
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit.mock.calls[0][1].crop.x).toBeLessThan(100);
});

it('focuses and activates crop controls with the keyboard', async () => {
  const { studio, frame, media, asset } = fixture(false);
  const ref = createRef<StudioCanvasHandle>();
  const commit = vi.fn();
  render(
    <div style={{ width: 500, height: 300 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        assets={[asset]}
        selected={[media.id]}
        editable
        fit="contain"
        onCropCommit={commit}
      />
    </div>
  );
  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  const slider = screen.getByRole<HTMLInputElement>('slider');
  slider.focus();
  expect(document.activeElement).toBe(slider);
  await userEvent.keyboard('{ArrowRight}');
  expect(Number(slider.value)).toBeGreaterThan(1);

  const reset = screen.getByRole<HTMLButtonElement>('button', { name: 'Reset' });
  reset.focus();
  expect(document.activeElement).toBe(reset);
  await userEvent.keyboard(' ');
  await waitFor(() =>
    expect(
      Number(screen.getByRole('toolbar', { name: 'Crop' }).getAttribute('data-crop-width'))
    ).toBe(200)
  );

  const cancel = screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' });
  cancel.focus();
  expect(document.activeElement).toBe(cancel);
  await userEvent.keyboard('{Enter}');
  expect(screen.queryByRole('toolbar', { name: 'Crop' })).toBeNull();
  expect(commit).not.toHaveBeenCalled();

  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  const apply = screen.getByRole<HTMLButtonElement>('button', { name: 'Apply' });
  apply.focus();
  expect(document.activeElement).toBe(apply);
  await userEvent.keyboard('{Enter}');
  expect(commit).toHaveBeenCalledTimes(1);
});

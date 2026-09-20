/* @vitest-environment jsdom */
import { useImperativeHandle } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '../../logic/templates';
import { element } from '../../logic/document';
const scene = vi.hoisted(() => ({
  nodes: {} as Record<string, any>,
  transformer: vi.fn(),
  draw: vi.fn(),
  stage: { findOne: vi.fn(), getPointerPosition: vi.fn() },
}));
vi.mock('react-konva', () => {
  const shape = (kind: string) => (p: any) => {
    scene.nodes[p.id || kind] = p;
    useImperativeHandle(p.ref, () =>
      kind === 'Stage'
        ? scene.stage
        : { nodes: scene.transformer, getLayer: () => ({ batchDraw: scene.draw }) }
    );
    return <div data-testid={p.id || kind}>{p.children}</div>;
  };
  return Object.fromEntries(
    ['Stage', 'Layer', 'Rect', 'Ellipse', 'Text', 'Image', 'Transformer', 'Group'].map(k => [
      k,
      shape(k),
    ])
  );
});
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key.replace('features.studio.', '') }),
}));
import StudioCanvas from '../StudioCanvas';
beforeEach(() => {
  vi.clearAllMocks();
  scene.nodes = {};
  scene.stage.findOne.mockReturnValue({});
  scene.stage.getPointerPosition.mockReturnValue({ x: 60, y: 120 });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      callback: any;
      constructor(cb: any) {
        this.callback = cb;
      }
      observe() {
        this.callback([{ contentRect: { width: 600 } }]);
      }
      disconnect() {
        this.callback = undefined;
      }
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('Studio canvas interaction', () => {
  it('clears selection on the canvas background while ignoring pointer events without coordinates', () => {
    const p = props();
    p.page.elements = [];
    render(<StudioCanvas {...p} guides={false} />);
    act(() => scene.nodes.Rect.onClick());
    expect(p.select).toHaveBeenCalledWith([]);
    scene.stage.getPointerPosition.mockReturnValue(null);
    act(() => scene.nodes.Stage.onPointerMove());
    expect(p.cursor).not.toHaveBeenCalled();
  });
  it('loads media previews, crops images, synchronizes video playback and releases media on replacement', async () => {
    const p = props(),
      imageId = crypto.randomUUID(),
      videoId = crypto.randomUUID();
    p.page.elements = [
      element('image', { assetId: imageId, width: 200, height: 100, fit: 'cover' }),
    ];
    const images: any[] = [];
    class LoadedImage {
      onload: any;
      width = 100;
      height = 100;
      constructor() {
        images.push(this);
      }
      source = '';
      set src(value: string) {
        this.source = value;
      }
    }
    vi.stubGlobal('Image', LoadedImage);
    const view = render(
      <StudioCanvas
        {...p}
        assets={[{ id: imageId, name: 'Image', mime: 'image/png', url: 'image.png' }]}
      />
    );
    act(() => images[0].onload());
    expect(scene.nodes.Image.width).toBe(200);
    expect(scene.nodes.Image.height).toBe(200);
    expect(scene.nodes.Image.y).toBe(-50);
    const native = document.createElement.bind(document),
      videos: HTMLVideoElement[] = [];
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string, options: any) => {
      const node = native(tag, options);
      if (tag === 'video') {
        videos.push(node as HTMLVideoElement);
        Object.defineProperties(node, {
          duration: { configurable: true, value: 12 },
          videoWidth: { value: 200 },
          videoHeight: { value: 100 },
        });
      }
      return node;
    }) as any);
    const play = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockRejectedValue(new Error('requires gesture')),
      pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined),
      load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    p.page.elements = [
      element('video', { assetId: videoId, trimStart: 2, muted: false, width: 200, height: 200 }),
    ];
    const assets = [{ id: videoId, name: 'Clip', mime: 'video/mp4', url: 'video.mp4' }];
    view.rerender(<StudioCanvas {...p} assets={assets} />);
    expect(images[0].onload).toBeNull();
    await act(async () => {
      videos[0].onloadeddata!(new Event('loadeddata'));
    });
    expect(videos[0].currentTime).toBe(2);
    expect(videos[0].muted).toBe(false);
    expect(scene.nodes.Image.height).toBe(100);
    await act(async () => {
      view.rerender(<StudioCanvas {...p} assets={assets} playing time={4} />);
    });
    expect(videos[0].currentTime).toBe(6);
    expect(play).toHaveBeenCalled();
    act(() => videos[0].onseeked!(new Event('seeked')));
    expect(scene.draw).toHaveBeenCalled();
    Object.defineProperty(videos[0], 'paused', { configurable: true, value: false });
    view.rerender(<StudioCanvas {...p} assets={assets} playing time={4.01} />);
    expect(videos[0].currentTime).toBe(6);
    Object.defineProperty(videos[0], 'duration', { configurable: true, value: Number.NaN });
    view.rerender(<StudioCanvas {...p} assets={assets} time={0} />);
    expect(videos[0].currentTime).toBe(0.95);
    view.unmount();
    expect(pause).toHaveBeenCalled();
    expect(load).toHaveBeenCalled();
    expect(videos[0].getAttribute('src')).toBeNull();
  });
  function props() {
    const page = createDocument('single', 'Canvas').pages[0];
    return {
      page,
      assets: [],
      peers: [],
      selected: [] as string[],
      editable: true,
      select: vi.fn(),
      patch: vi.fn(),
      cursor: vi.fn(),
    };
  }
  it('provides focusable keyboard selection, incremental movement and immutable read-only or locked objects', () => {
    const p = props(),
      item = p.page.elements[1];
    const view = render(<StudioCanvas {...p} />);
    const button = screen.getByRole('button', { name: `2. ${item.text}` });
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(p.select).toHaveBeenLastCalledWith([item.id]);
    fireEvent.keyDown(button, { key: 'ArrowRight', shiftKey: true });
    expect(p.patch).toHaveBeenLastCalledWith(item.id, { x: item.x + 10, y: item.y });
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(p.patch).toHaveBeenLastCalledWith(item.id, { x: item.x, y: item.y + 1 });
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(p.select).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByRole('button', { name: 'clearSelection' }));
    expect(p.select).toHaveBeenLastCalledWith([]);
    view.rerender(<StudioCanvas {...p} selected={[p.page.elements[0].id]} />);
    fireEvent.click(button, { shiftKey: true });
    expect(p.select).toHaveBeenLastCalledWith([p.page.elements[0].id, item.id]);
    p.patch.mockClear();
    view.rerender(<StudioCanvas {...p} editable={false} />);
    fireEvent.keyDown(button, { key: 'ArrowLeft' });
    expect(p.patch).not.toHaveBeenCalled();
    item.locked = true;
    view.rerender(<StudioCanvas {...p} />);
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expect(p.patch).not.toHaveBeenCalled();
    item.locked = false;
    view.rerender(<StudioCanvas {...p} playing />);
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    expect(p.patch).not.toHaveBeenCalled();
  });
  it('selects by pointer and touch, snaps dragging and preserves scale when committing a transform', () => {
    const p = props(),
      item = p.page.elements[1];
    render(<StudioCanvas {...p} selected={[p.page.elements[0].id]} />);
    const node = scene.nodes[item.id];
    node.onClick({ evt: { shiftKey: true } });
    expect(p.select).toHaveBeenLastCalledWith([p.page.elements[0].id, item.id]);
    node.onClick({ evt: {} });
    node.onTap();
    expect(p.select).toHaveBeenLastCalledWith([item.id]);
    node.onDragMove({ target: { x: () => 127, y: () => 233 } });
    expect(p.patch).toHaveBeenLastCalledWith(item.id, { x: 125, y: 235 });
    const scaleX = vi.fn().mockReturnValue(2),
      scaleY = vi.fn().mockReturnValue(0);
    node.onTransformEnd({
      target: { x: () => 50, y: () => 60, scaleX, scaleY, rotation: () => 15 },
    });
    expect(p.patch).toHaveBeenLastCalledWith(item.id, {
      x: 50,
      y: 60,
      width: item.width * 2,
      height: 4,
      rotation: 15,
    });
    expect(scaleX).toHaveBeenCalledWith(1);
    expect(scaleY).toHaveBeenCalledWith(1);
    const stage = scene.nodes.Stage;
    stage.onPointerMove();
    expect(p.cursor).toHaveBeenCalledWith(108, 216);
    const target = { getStage: () => target };
    stage.onPointerDown({ target });
    expect(p.select).toHaveBeenLastCalledWith([]);
    p.select.mockClear();
    stage.onPointerDown({ target: { getStage: () => target } });
    expect(p.select).not.toHaveBeenCalled();
    const old = { width: 10, height: 10 };
    expect(scene.nodes.Transformer.boundBoxFunc(old, { width: 2, height: 10 })).toBe(old);
    expect(scene.nodes.Transformer.boundBoxFunc(old, { width: 10, height: 2 })).toBe(old);
    const resized = { width: 20, height: 30 };
    expect(scene.nodes.Transformer.boundBoxFunc(old, resized)).toBe(resized);
    expect(scene.transformer).toHaveBeenCalled();
  });
  it('renders different shapes, placeholders, matching peer cursors and a bounded transition during preview', () => {
    const p = props();
    p.page.format = 'story';
    p.page.transition = 'fade';
    p.page.elements.push(element('ellipse'), element('image'), element('video'));
    p.page.elements[0].animation = 'fade';
    p.page.elements.push(element('text', { text: 'Bold heading', bold: true }));
    const view = render(
      <StudioCanvas
        {...p}
        peers={[{ cursor: { pageId: p.page.id, x: 4, y: 6 } }, { cursor: { pageId: 'other' } }]}
      />
    );
    expect(scene.nodes[p.page.elements.at(-2)!.id]).toBeTruthy();
    expect(scene.nodes.Rect.fill).toBeUndefined();
    view.rerender(<StudioCanvas {...p} playing time={0.1} guides={false} />);
    expect(scene.nodes.Text.fontStyle).toBe('bold');
    expect(scene.nodes[p.page.elements[0].id].opacity).toBe(p.page.elements[0].opacity * 0.25);
    expect(scene.nodes.Rect.fill).toBe('#000000');
    expect(scene.nodes.Rect.opacity).toBeGreaterThan(0);
  });
});

import { createRef, useState } from 'react';
import Konva from 'konva';
import { act, render, screen, waitFor } from '@testing-library/react';
import { page, userEvent } from 'vitest/browser';
import { expect, it, vi } from 'vitest';
import KonvaStudioCanvas, {
  type StudioCanvasHandle,
  type StudioCanvasState,
} from '../KonvaStudioCanvas';
import { defaultBrand } from '../../logic/document';
import { createFrameNode } from '../../logic/document-v3';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import { worldBounds } from '../../logic/selection-geometry';
import { ProjectContextChips } from '@/features/project-chat/ui/ProjectContextChips';
import { ProjectContextNavigation } from '@/features/project-chat/ui/ProjectContextNavigation';
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
}));

it.each([false, true])(
  'focuses nested rotated objects beside an open chat with native keyboard activation (mobile=%s)',
  async mobile => {
    await page.viewport(mobile ? 430 : 1280, mobile ? 880 : 800);
    const document = createStudioTemplateDocumentV5('single', 'Focus', defaultBrand);
    const root = document.nodes.find(node => node.type === 'frame')!;
    root.transform.x = 1800;
    root.transform.rotation = 12;
    const nested = createFrameNode('custom', {
      parentFrameId: root.id,
      transform: { x: 150, y: 100, width: 400, height: 300, rotation: 20 },
    });
    document.nodes.push(nested);
    const node = document.nodes.find(node => node.type === 'richText')!;
    node.parentFrameId = nested.id;
    Object.assign(node.transform, { x: 40, y: 50, width: 80, height: 60 });
    node.locked = true;
    const ref = createRef<StudioCanvasHandle>();
    const state: { current: StudioCanvasState | null } = { current: null };
    const errors: unknown[] = [];
    const focusRequests: Promise<void>[] = [];
    const activations = vi.fn();
    function Harness() {
      const [selected, select] = useState<string[]>([]);
      return (
        <div
          className="canvas-focus-test"
          style={{ position: 'relative', width: mobile ? 390 : 1000 }}
        >
          <style>{`.canvas-focus-test .polity-canvas { height: ${mobile ? 760 : 600}px; min-height: 0; }`}</style>
          <KonvaStudioCanvas
            ref={ref}
            document={document}
            activeFrameId={root.id}
            selected={selected}
            selectExact={select}
            assets={[]}
            editable
            guides={false}
            onCanvasStateChange={value => {
              state.current = value;
            }}
          />
          {selected.length > 0 && !mobile && (
            <div
              data-canvas-focus-occluder
              style={{ position: 'absolute', top: 0, left: 0, width: 180, height: 200 }}
            >
              Inspector
            </div>
          )}
          <div data-project-chat-dock>
            <section
              role="dialog"
              aria-label="Chat"
              style={{
                position: 'absolute',
                top: mobile ? 220 : 120,
                left: mobile ? 0 : 650,
                width: mobile ? 390 : 350,
                height: mobile ? 540 : 480,
                background: 'white',
              }}
            >
              <ProjectContextNavigation.Provider
                value={reference => {
                  activations(reference.id);
                  focusRequests.push(
                    ref.current!.execute({ type: 'focus', nodeId: reference.id }).catch(error => {
                      errors.push(error);
                    })
                  );
                }}
              >
                <ProjectContextChips
                  references={[
                    {
                      kind: 'element',
                      id: node.id,
                      label: 'Heading',
                      origin: 'automatic',
                      workspaceId: null,
                    },
                  ]}
                />
              </ProjectContextNavigation.Provider>
            </section>
          </div>
        </div>
      );
    }
    render(<Harness />);
    const host = await screen.findByTestId('studio-canvas');
    await waitFor(() => {
      const stage = Konva.stages.find(candidate => host.contains(candidate.container()));
      expect(stage?.width()).toBe(mobile ? 390 : 1000);
      expect(stage?.height()).toBe(mobile ? 760 : 600);
    });
    await waitFor(() => expect(state.current?.zoom).toBeLessThan(1));
    await act(async () => {
      await ref.current!.execute({ type: 'zoom', mode: 'reset' });
    });
    await waitFor(() => expect(state.current?.zoom).toBe(1));
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'element · Heading' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(activations).toHaveBeenCalledTimes(1));
    await act(async () => {
      await focusRequests[0];
    });
    const freeCenter = { x: mobile ? 195 : 415, y: mobile ? 110 : 300 };
    const bounds = worldBounds(document, node);
    await waitFor(() => {
      const rect = host.getBoundingClientRect();
      const point = ref.current!.scenePoint(rect.left + freeCenter.x, rect.top + freeCenter.y);
      expect(point.x).toBeCloseTo((bounds.left + bounds.right) / 2, 1);
      expect(point.y).toBeCloseTo((bounds.top + bounds.bottom) / 2, 1);
    });
    expect(state.current?.zoom).toBe(1);
    expect(screen.getByRole('dialog', { name: 'Chat' })).toBeTruthy();
    await act(async () => {
      await ref.current!.execute({ type: 'zoom', mode: 'all' });
    });
    await waitFor(() => expect(state.current?.zoom).toBeLessThan(1));
    button.focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(activations).toHaveBeenCalledTimes(2));
    await act(async () => {
      await focusRequests[1];
    });
    await waitFor(() => {
      const rect = host.getBoundingClientRect();
      const point = ref.current!.scenePoint(rect.left + freeCenter.x, rect.top + freeCenter.y);
      expect(point.x).toBeCloseTo((bounds.left + bounds.right) / 2, 1);
    });
    expect(errors).toEqual([]);
    await act(async () => {
      await ref.current!.execute({ type: 'focus', nodeId: root.id });
    });
    expect(state.current!.zoom).toBeLessThan(1);
    await expect(ref.current!.execute({ type: 'focus', nodeId: 'deleted' })).rejects.toThrow();
    nested.visible = false;
    await expect(ref.current!.execute({ type: 'focus', nodeId: node.id })).rejects.toThrow();
    expect(node.locked).toBe(true);
    await page.viewport(1280, 800);
  }
);

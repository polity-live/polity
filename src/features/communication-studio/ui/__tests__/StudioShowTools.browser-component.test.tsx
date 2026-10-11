import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { StudioShowTools } from '../StudioShowTools';
import { StudioPanel } from '../StudioPanel';
import { Toolbar } from '@/features/shared/ui/layout';
import { Music } from 'lucide-react';
import { createEventTemplate } from '../../logic/event-templates';
import type { StudioDocumentV3 } from '../../logic/document-v3';
import Konva from 'konva';
import '@/font-faces.css';
import '@/styles.css';

const eventId = crypto.randomUUID();
const initial = createEventTemplate('cover', eventId);
const second = createEventTemplate('speech', crypto.randomUUID());
initial.nodes[0].name = 'Opening';
second.nodes[0].name = 'Debate';
second.nodes[0].zIndex = 1;
initial.nodes.push(...second.nodes);
const title = initial.nodes.find(n => n.liveBinding?.field === 'title')!;
title.showAnimation = { preset: 'fade', duration: 1, intensity: 0.5 };

function Harness() {
  const [document, setDocument] = useState(initial);
  const [selected, select] = useState(title.id);
  const [frameId, setFrame] = useState(initial.nodes[0].id);
  const [assets, setAssets] = useState<{ id: string; name: string; mime: string }[]>([]);
  const update = (edit: (d: StudioDocumentV3) => void) =>
    setDocument(old => {
      const next = structuredClone(old);
      edit(next);
      return next;
    });
  return (
    <div className="bg-background min-h-screen p-4">
      <Toolbar className="rounded border p-2">
        <StudioPanel
          panelKey="music-animation"
          label="Music & Animation"
          icon={<Music />}
          keepOpenOnDialogInteraction
          keepOpenOnCanvasInteraction
          unmountWhenClosed
        >
          <StudioShowTools
            document={document}
            frameId={frameId}
            selectedId={selected}
            sources={[
              {
                source_type: 'event',
                source_id: eventId,
                payload: {
                  title: 'Democracy, freedom and our shared future',
                  start: new Date(Date.now() + 7200000).toISOString(),
                },
              },
            ]}
            assets={assets}
            portrait={false}
            update={update}
            onSelect={(node, root) => {
              select(node.id);
              setFrame(root);
            }}
            onUpload={async file => {
              const asset = { id: crypto.randomUUID(), name: file.name, mime: file.type };
              setAssets(old => [...old, asset]);
              return asset;
            }}
          />
        </StudioPanel>
      </Toolbar>
      <button
        className="fixed right-4 bottom-4"
        data-canvas-engine="konva"
        onClick={() => select(title.id)}
      >
        Select title on canvas
      </button>
      <output data-testid="stored-show">{JSON.stringify(document.show)}</output>
    </div>
  );
}

it.each([
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  { name: '4k', width: 3840, height: 2160 },
])(
  'supports the layer tree, audio drop/upload, saved rules and animated previews on $name',
  async ({ name, width, height }) => {
    await page.viewport(width, height);
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Music & Animation' }));
    const tree = await screen.findByRole('tree');
    expect(tree.querySelector(`[data-show-layer-id="${title.id}"]`)).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Slide 2 · Debate' })).toBeVisible();
    const panel = tree.closest('[role="dialog"]');
    if (panel)
      await Promise.all(
        panel
          .getAnimations({ subtree: true })
          .filter(a => a.effect?.getTiming().iterations !== Infinity)
          .map(a => a.finished)
      );
    await page.screenshot({
      path: `../../../../../output/playwright/studio-show-tree-${name}.png`,
    });
    if (name !== 'mobile') {
      await userEvent.click(screen.getByRole('button', { name: 'Select title on canvas' }));
      expect(screen.getByRole('tree')).toBeVisible();
    }
    await userEvent.click(screen.getByRole('button', { name: 'Add music' }));
    const editor = screen.getByRole('dialog', { name: 'Edit slide music' });
    const dropzone = within(editor).getByTestId('studio-audio-dropzone');
    const file = new File(['RIFF-preview-fixture'], 'My soundtrack.wav', { type: 'audio/wav' });
    if (name === 'mobile')
      await userEvent.upload(within(dropzone).getByLabelText('Upload audio'), file);
    else {
      const dataTransfer = { files: [file], dropEffect: 'copy' };
      const enter = new Event('dragenter', { bubbles: true, cancelable: true });
      Object.defineProperty(enter, 'dataTransfer', { value: dataTransfer });
      fireEvent(dropzone, enter);
      expect(within(dropzone).getByText('Drop to upload')).toBeVisible();
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
      fireEvent(dropzone, drop);
    }
    await waitFor(() =>
      expect(within(editor).getByRole('combobox', { name: 'Music or sound' })).toHaveTextContent(
        file.name
      )
    );
    expect(screen.getByTestId('stored-show')).not.toHaveTextContent('assetId');
    await userEvent.click(within(editor).getByRole('button', { name: 'Save' }));
    expect(
      screen.getByRole('button', { name: /When slide “Opening” is shown: My soundtrack.wav/ })
    ).toBeVisible();
    const region = within(screen.getByRole('region', { name: 'Slide music' }));
    await userEvent.click(region.getByRole('button', { name: 'Remove' }));
    expect(screen.getByTestId('stored-show')).not.toHaveTextContent('assetId');
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByTestId('stored-show')).toHaveTextContent('assetId');
    const animations = within(screen.getByRole('region', { name: 'Animations' }));
    await userEvent.click(animations.getByRole('button', { name: 'Edit' }));
    const background = screen.getByRole('dialog', { name: 'Slide background' });
    await userEvent.click(
      within(background).getByRole('button', { name: 'Democracy — Illustration' })
    );
    await userEvent.click(within(background).getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(background.querySelectorAll('canvas').length).toBeGreaterThan(3));
    await page.screenshot({
      path: `../../../../../output/playwright/studio-show-animation-${name}.png`,
    });
    await userEvent.click(within(background).getByRole('button', { name: 'Pause' }));
    await userEvent.click(within(background).getByRole('button', { name: 'Cancel' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tree')).toBeNull());
    await waitFor(() => expect(Konva.stages).toHaveLength(0));
  },
  30000
);

it('Listen decodes and starts local native audio, with stop and dialog cleanup', async () => {
  await page.viewport(1280, 900);
  const NativeAudio = window.Audio;
  const players: HTMLAudioElement[] = [];
  vi.stubGlobal('Audio', function () {
    const player = new NativeAudio();
    players.push(player);
    return player;
  });
  const view = render(<Harness />);
  try {
    await userEvent.click(screen.getByRole('button', { name: 'Music & Animation' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add music' }));
    const editor = screen.getByRole('dialog', { name: 'Edit slide music' });
    const when = within(editor).getByRole('combobox', { name: 'When' });
    const action = within(editor).getByRole('combobox', { name: 'Action' });
    expect(when.getBoundingClientRect().top).toBe(action.getBoundingClientRect().top);
    await userEvent.click(within(editor).getByRole('combobox', { name: 'Music or sound' }));
    await userEvent.click(screen.getByRole('option', { name: /Test sound/ }));
    editor.scrollTop = 0;
    await Promise.all(
      editor
        .getAnimations({ subtree: true })
        .filter(a => a.effect?.getTiming().iterations !== Infinity)
        .map(a => a.finished)
    );
    await page.screenshot({
      path: '../../../../../output/playwright/studio-show-trigger-action.png',
    });
    await userEvent.click(within(editor).getByRole('button', { name: 'Listen' }));
    await waitFor(
      () => {
        expect(
          players.some(
            player =>
              player.src.includes('test-tone') &&
              !player.paused &&
              player.volume > 0 &&
              player.currentTime > 0
          )
        ).toBe(true);
      },
      { timeout: 10000 }
    );
    await userEvent.click(within(editor).getByRole('button', { name: 'Stop preview' }));
    expect(players.every(player => player.paused)).toBe(true);
    await userEvent.click(within(editor).getByRole('button', { name: 'Listen' }));
    await waitFor(
      () =>
        expect(players.some(player => player.src.includes('test-tone') && !player.paused)).toBe(
          true
        ),
      { timeout: 10000 }
    );
    await userEvent.click(within(editor).getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(players.every(player => player.paused && !player.getAttribute('src'))).toBe(true)
    );
  } finally {
    view.unmount();
    vi.unstubAllGlobals();
  }
}, 30000);

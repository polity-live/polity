// @vitest-environment jsdom
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { StudioShowTools } from '../StudioShowTools';
import { createEventTemplate } from '../../logic/event-templates';
import { studioDocumentV3Schema, type StudioDocumentV3 } from '../../logic/document-v3';
import { showCueSchema } from '../../logic/live-contract';

vi.mock('../KonvaStudioCanvas', () => ({
  default: ({ activeFrameId }: { activeFrameId: string }) => (
    <div data-testid="frame-preview">{activeFrameId}</div>
  ),
}));
vi.mock('../../logic/event-intro-player', () => ({ createIntroPlayer: () => vi.fn() }));
const event = crypto.randomUUID(),
  asset = crypto.randomUUID(),
  video = crypto.randomUUID();
const document = createEventTemplate('cover', event);
const speech = createEventTemplate('speech', crypto.randomUUID());
document.nodes.push(...speech.nodes);
document.nodes[0].name = 'Opening';
speech.nodes[0].name = 'Debate';
speech.nodes[0].zIndex = 1;
document.nodes.find(n => n.type === 'richText')!.showAnimation = {
  preset: 'fade',
  duration: 1,
  intensity: 0.5,
};
speech.nodes.find(n => n.type === 'richText')!.showAnimation = {
  preset: 'fade',
  duration: 1,
  intensity: 0.5,
};
const commits = vi.fn();
function Harness({
  initial = document,
  disabled = false,
  upload,
}: {
  initial?: StudioDocumentV3;
  disabled?: boolean;
  upload?: (file: File) => Promise<any>;
}) {
  const [doc, setDoc] = useState(initial);
  const [frame, setFrame] = useState(initial.nodes[0].id);
  const [selected, setSelected] = useState(initial.nodes.find(n => n.type === 'richText')?.id);
  const [assets, setAssets] = useState([
    { id: asset, name: 'My sound', mime: 'audio/wav' },
    { id: video, name: 'Opening.mp4', mime: 'video/mp4' },
  ]);
  return (
    <>
      <button onClick={() => setFrame(speech.nodes[0].id)}>Next slide</button>
      <StudioShowTools
        document={doc}
        frameId={frame}
        selectedId={selected}
        onSelect={(node, frame) => {
          setFrame(frame);
          setSelected(node.id);
        }}
        sources={[]}
        assets={assets}
        update={edit => {
          setDoc(old => {
            const next = structuredClone(old);
            edit(next);
            commits(next);
            return next;
          });
        }}
        portrait={false}
        disabled={disabled}
        onUpload={
          upload
            ? async file => {
                const uploaded = await upload(file);
                if (uploaded) setAssets(old => [...old, uploaded]);
                return uploaded;
              }
            : undefined
        }
      />
      <output data-testid="document">{JSON.stringify(doc)}</output>
    </>
  );
}
const doc = () => JSON.parse(screen.getByTestId('document').textContent!) as StudioDocumentV3;
async function choose(label: string, option: string | RegExp) {
  await userEvent.click(screen.getByRole('combobox', { name: label }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}
beforeEach(() => {
  commits.mockClear();
  HTMLMediaElement.prototype.load = vi.fn();
  HTMLMediaElement.prototype.pause = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
it('shows the slide context and commits add/edit once, with source and target fully editable', async () => {
  render(<Harness />);
  expect(screen.getAllByText('Slide 1 · Opening')).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Add music' }));
  expect(screen.getByRole('button', { name: 'Save' }).matches(':disabled')).toBe(true);
  await choose('Music or sound', /Cinematic opening/);
  expect(doc().show!.cues).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(commits).toHaveBeenCalledTimes(1);
  const first = doc().show!.cues[0];
  expect(first).toMatchObject({
    frameId: document.nodes[0].id,
    builtin: 'cinematic-sequence',
    channel: 'music',
    fadeInSeconds: 1,
    fadeOutSeconds: 1,
    volume: 0.65,
  });
  expect(screen.getByRole('button', { name: /When slide “Opening” is shown/ })).toBeTruthy();
  await userEvent.click(
    within(screen.getByRole('region', { name: 'Slide music' })).getByRole('button', {
      name: 'Edit',
    })
  );
  await choose('Music or sound', 'My sound');
  await choose('Target slide', /Debate/);
  fireEvent.keyDown(screen.getByRole('slider', { name: /^Volume/ }), { key: 'End' });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Fade out (seconds)' }), {
    target: { value: '2' },
  });
  expect(commits).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(doc().show!.cues[0]).toMatchObject({
    id: first.id,
    assetId: asset,
    frameId: speech.nodes[0].id,
    volume: 1,
    fadeOutSeconds: 2,
  });
  expect(doc().show!.cues[0].builtin).toBeUndefined();
  expect(commits).toHaveBeenCalledTimes(2);
  expect(studioDocumentV3Schema.safeParse(doc()).success).toBe(true);
});
it('cancels drafts, prevents duplicate rules and restores a removed rule', async () => {
  const initial = structuredClone(document);
  initial.show!.cues = [
    showCueSchema.parse({
      id: crypto.randomUUID(),
      frameId: initial.nodes[0].id,
      builtin: 'test-tone',
      trigger: 'enter',
    }),
  ];
  render(<Harness initial={initial} />);
  await userEvent.click(screen.getByRole('button', { name: 'Add music' }));
  await choose('Music or sound', /Eternal Hope/);
  expect(screen.getByRole('alert').textContent).toContain('Another rule');
  expect(screen.getByRole('button', { name: 'Save' }).matches(':disabled')).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(commits).not.toHaveBeenCalled();
  const music = within(screen.getByRole('region', { name: 'Slide music' }));
  await userEvent.click(music.getByRole('button', { name: 'Remove' }));
  expect(doc().show!.cues).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(doc().show!.cues).toEqual(initial.show!.cues);
});
it('creates a global transition, preserves it on other slides and disables test tone looping', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: 'Add transition sound' }));
  await choose('Applies to', 'All slide changes');
  await choose('Music or sound', /Test sound/);
  expect(screen.queryByRole('checkbox', { name: 'Repeat music' })).toBeNull();
  expect(
    (screen.getByRole('spinbutton', { name: 'Total duration (seconds)' }) as HTMLInputElement)
      .valueAsNumber
  ).toBe(3);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  const cue = doc().show!.cues[0];
  expect(cue).toMatchObject({
    scope: 'global',
    channel: 'transition',
    builtin: 'test-tone',
    loop: false,
    durationSeconds: 3,
  });
  expect(cue.frameId).toBeUndefined();
  await userEvent.click(screen.getByRole('button', { name: 'Next slide' }));
  expect(screen.getByRole('button', { name: /On every slide change/ })).toBeTruthy();
});
it('edits background scenes as drafts, preserves cover content and removes the fallback explicitly', async () => {
  render(<Harness />);
  const before = JSON.stringify(doc().nodes.slice(1));
  await userEvent.click(
    within(screen.getByRole('region', { name: 'Animations' })).getAllByRole('button', {
      name: 'Edit',
    })[0]
  );
  await userEvent.click(screen.getByRole('button', { name: 'Democracy — 3D' }));
  expect(commits).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect((doc().nodes[0] as any).intro.scene).toBe('democracy-sculptural');
  expect(JSON.stringify(doc().nodes.slice(1))).toBe(before);
  await userEvent.click(screen.getByRole('button', { name: 'Remove background animation' }));
  expect((doc().nodes[0] as any).intro).toMatchObject({ mode: 'static', assetId: null });
  await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect((doc().nodes[0] as any).intro).toMatchObject({
    mode: 'spatial',
    scene: 'democracy-sculptural',
  });
});
it('supports source-free pause rules and marks missing files rather than saving an invalid source', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: 'Add music' }));
  await choose('Action', 'Pause current music');
  expect(screen.queryByRole('combobox', { name: 'Music or sound' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(doc().show!.cues[0]).toMatchObject({ action: 'pause', trigger: 'enter' });
});
it('keeps previews available but disables editing in read-only projects', async () => {
  render(<Harness disabled />);
  expect(screen.getByRole('button', { name: 'Add music' }).matches(':disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Add transition sound' }).matches(':disabled')).toBe(
    true
  );
  expect(screen.getByRole('button', { name: 'Preview slide' }).matches(':disabled')).toBe(false);
});

it('shows every slide, selects layers in the canvas and highlights the selected row', async () => {
  render(<Harness />);
  expect(screen.getByRole('button', { name: 'Slide 2 · Debate' })).toBeTruthy();
  const firstNode = document.nodes.find(n => n.type === 'richText')!;
  const firstRow = screen
    .getByRole('tree')
    .querySelector(`[data-show-layer-id="${firstNode.id}"]`)!;
  expect(firstRow.getAttribute('aria-selected')).toBe('true');
  await userEvent.click(screen.getByRole('button', { name: 'Slide 2 · Debate' }));
  const nextNode = speech.nodes.find(n => n.type === 'richText')!;
  const nextRow = screen.getByRole('tree').querySelector(`[data-show-layer-id="${nextNode.id}"]`)!;
  await userEvent.click(
    within(nextRow as HTMLElement).getByRole('button', { name: nextNode.name })
  );
  expect(nextRow.getAttribute('aria-selected')).toBe('true');
  expect(firstRow.getAttribute('aria-selected')).toBe('false');
  await userEvent.click(
    within(nextRow as HTMLElement).getByRole('button', { name: `Edit animation: ${nextNode.name}` })
  );
  expect(within(screen.getByRole('dialog')).getByText('Slide 2 · Debate')).toBeTruthy();
});
it('reuses the image dropzone for audio, validates files and only saves the new source on confirmation', async () => {
  const uploaded = { id: crypto.randomUUID(), name: 'Intro.mp3', mime: 'audio/mpeg' };
  const upload = vi.fn(async () => uploaded);
  render(<Harness upload={upload} />);
  await userEvent.click(screen.getByRole('button', { name: 'Add music' }));
  const dropzone = screen.getByTestId('studio-audio-dropzone');
  fireEvent.drop(dropzone, {
    dataTransfer: { files: [new File(['x'], 'image.png', { type: 'image/png' })] },
  });
  expect(upload).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('MP3 or WAV');
  const file = new File(['audio'], 'Intro.mp3', { type: 'audio/mpeg' });
  fireEvent.dragEnter(dropzone, { dataTransfer: { files: [file] } });
  expect(screen.getByText('Drop to upload')).toBeTruthy();
  fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Music or sound' }).textContent).toContain(
      'Intro.mp3'
    )
  );
  expect(upload).toHaveBeenCalledWith(file);
  expect(commits).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(doc().show!.cues[0]).toMatchObject({ assetId: uploaded.id });
  expect(commits).toHaveBeenCalledTimes(1);
});
it('does not assign an upload finishing after its editor has been cancelled to a different rule', async () => {
  let resolve!: (asset: { id: string; name: string; mime: string }) => void;
  const upload = () =>
    new Promise<{ id: string; name: string; mime: string }>(done => {
      resolve = done;
    });
  render(<Harness upload={upload} />);
  await userEvent.click(screen.getByRole('button', { name: 'Add music' }));
  fireEvent.drop(screen.getByTestId('studio-audio-dropzone'), {
    dataTransfer: { files: [new File(['a'], 'Intro.wav', { type: 'audio/wav' })] },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await userEvent.click(screen.getByRole('button', { name: 'Add transition sound' }));
  resolve({ id: crypto.randomUUID(), name: 'Intro.wav', mime: 'audio/wav' });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' }).matches(':disabled')).toBe(true)
  );
  expect(screen.getByRole('combobox', { name: 'Music or sound' }).textContent).toContain(
    'Choose music'
  );
  expect(commits).not.toHaveBeenCalled();
});

it('lists only top-level slides and configured animations, with aligned icon actions', async () => {
  const initial = structuredClone(document);
  const plain = initial.nodes.find(n => n.type !== 'frame')!;
  plain.showAnimation = undefined;
  const animated = initial.nodes.find(n => n.type !== 'frame' && n.id !== plain.id)!;
  animated.showAnimation = { preset: 'fade', duration: 1, intensity: 0.5 };
  render(<Harness initial={initial} />);
  const tree = screen.getByRole('tree');
  expect(tree.querySelector(`[data-show-layer-id="${plain.id}"]`)).toBeNull();
  const row = tree.querySelector(`[data-show-layer-id="${animated.id}"]`)! as HTMLElement;
  expect(
    within(row).getByRole('button', { name: `Edit animation: ${animated.name}` }).textContent
  ).toBe('');
  expect(
    within(row).getByRole('button', { name: `Remove animation: ${animated.name}` }).textContent
  ).toBe('');
  await userEvent.click(
    within(row).getByRole('button', { name: `Remove animation: ${animated.name}` })
  );
  expect(tree.querySelector(`[data-show-layer-id="${animated.id}"]`)).toBeNull();
  expect(doc().nodes.some(n => n.id === animated.id)).toBe(true);
  expect(screen.getAllByText('Slide 1 · Opening')).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Add element animation' }));
  expect(screen.getByRole('combobox', { name: 'Element' })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
});

it('keeps the upload draft open while the editor becomes temporarily busy', async () => {
  let finish!: (asset: { id: string; name: string; mime: string }) => void;
  const upload = () =>
    new Promise<{ id: string; name: string; mime: string }>(resolve => {
      finish = resolve;
    });
  const view = render(<Harness upload={upload} />);
  await userEvent.click(screen.getByRole('button', { name: 'Add music' }));
  fireEvent.drop(screen.getByTestId('studio-audio-dropzone'), {
    dataTransfer: { files: [new File(['sound'], 'Intro.wav', { type: 'audio/wav' })] },
  });
  view.rerender(<Harness upload={upload} disabled />);
  expect(screen.getByRole('dialog', { name: 'Edit slide music' })).toBeTruthy();
  finish({ id: crypto.randomUUID(), name: 'Intro.wav', mime: 'audio/wav' });
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Music or sound' }).textContent).toContain(
      'Intro.wav'
    )
  );
  view.rerender(<Harness upload={upload} />);
  expect(screen.getByRole('button', { name: 'Save' }).matches(':disabled')).toBe(false);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(doc().show!.cues).toHaveLength(1);
  const row = screen.getByRole('region', { name: 'Slide music' });
  expect(within(row).getByRole('img', { name: 'When: Show frame' })).toBeTruthy();
  expect(within(row).getByRole('img', { name: 'Action: Play music' })).toBeTruthy();
});

it('shows playback failures as a Polity danger notice and clears them when editing the source', async () => {
  const NativeAudio = window.Audio;
  vi.stubGlobal('Audio', function () {
    const media = new NativeAudio();
    media.play = vi.fn(async () => {
      throw new Error('Browser activation interrupted');
    });
    return media;
  });
  try {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Add music' }));
    await choose('Music or sound', /Test sound/);
    await userEvent.click(screen.getByRole('button', { name: 'Listen' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Preview could not play');
    expect(alert.querySelector('[class*="badge-danger"]')).not.toBeNull();
    await choose('Music or sound', /Eternal Hope/);
    expect(screen.queryByRole('alert')).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});

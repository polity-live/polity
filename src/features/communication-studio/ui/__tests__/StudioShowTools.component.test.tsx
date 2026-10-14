// @vitest-environment jsdom
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useState, type ComponentProps } from 'react';
import { ShowSelect, StudioShowTools } from '../StudioShowTools';
import { createEventTemplate } from '../../logic/event-templates';
import { studioDocumentV3Schema, type StudioDocumentV3 } from '../../logic/document-v3';
import { showCueSchema } from '../../logic/live-contract';
import { createStudioDocumentV3 } from '../../logic/document-v3';
import { act } from '@testing-library/react';

vi.mock('../KonvaStudioCanvas', () => ({
  default: ({ activeFrameId }: { activeFrameId: string }) => (
    <div data-testid="frame-preview">{activeFrameId}</div>
  ),
}));
vi.mock('../../logic/event-intro-player', () => ({
  createIntroPlayer: (
    _canvas: unknown,
    _intro: unknown,
    _theme: unknown,
    _url: unknown,
    now: () => number,
    redraw: () => void
  ) => {
    now();
    redraw();
    return vi.fn();
  },
}));
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
let user: ReturnType<typeof userEvent.setup>;
const doc = () => JSON.parse(screen.getByTestId('document').textContent!) as StudioDocumentV3;
async function choose(label: string, option: string | RegExp) {
  const trigger = screen.getByLabelText(label, { selector: 'button[role="combobox"]' });
  await user.click(trigger);
  const choices = within(await screen.findByRole('listbox'));
  await user.click(choices.getByRole('option', { name: option }));
}
beforeEach(() => {
  user = userEvent.setup({ delay: null });
  commits.mockClear();
  HTMLMediaElement.prototype.load = vi.fn();
  HTMLMediaElement.prototype.pause = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function controlledTools(
  initial: StudioDocumentV3,
  extra: Partial<ComponentProps<typeof StudioShowTools>> = {}
) {
  let current = initial;
  const props = {
    document: current,
    frameId: initial.nodes.find(node => node.type === 'frame')?.id ?? 'missing',
    sources: [],
    assets: [
      { id: asset, name: 'My sound', mime: 'audio/wav' },
      { id: video, name: 'Opening.mp4', mime: 'video/mp4' },
    ],
    portrait: false,
    update: (edit: (document: StudioDocumentV3) => void) => {
      const next = structuredClone(current);
      edit(next);
      current = next;
      commits(next);
    },
    ...extra,
  };
  const r = render(<StudioShowTools {...props} />);
  return {
    ...r,
    replace(next: StudioDocumentV3) {
      current = next;
      r.rerender(<StudioShowTools {...props} document={next} />);
    },
    rebase(next: StudioDocumentV3) {
      current = next;
    },
    current: () => current,
  };
}

class PreviewAudio extends EventTarget {
  static instances: PreviewAudio[] = [];
  src = '';
  duration = 61;
  readyState = 1;
  currentTime = 0;
  volume = 1;
  paused = true;
  loop = false;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn();
  removeAttribute() {
    this.src = '';
  }
  constructor() {
    super();
    PreviewAudio.instances.push(this);
  }
}

it('renders an empty project and ungrouped choices without inventing a selected slide', async () => {
  controlledTools(createStudioDocumentV3('Empty'));
  expect(screen.getByText('Choose a slide first.')).toBeTruthy();
  const change = vi.fn();
  render(
    <ShowSelect
      label="Example choices"
      value="first"
      options={[
        { value: 'first', label: 'First' },
        { value: 'second', label: 'Second', disabled: true },
      ]}
      onChange={change}
    />
  );
  await choose('Example choices', 'First');
  expect(change).not.toHaveBeenCalled();
});

it('closes desktop and mobile editors through escape without committing their drafts', async () => {
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Add music' }));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(commits).not.toHaveBeenCalled();
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  await user.click(screen.getByRole('button', { name: 'Add music' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(commits).not.toHaveBeenCalled();
});

it('keeps invalid numeric edits out of drafts and commits explicit fade and transition durations', async () => {
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Add sound for all slide changes' }));
  await choose('Music or sound', 'My sound');
  const fade = screen.getByRole('spinbutton', { name: 'Fade in (seconds)' });
  for (const value of ['', '-1', '31']) fireEvent.change(fade, { target: { value } });
  expect((fade as HTMLInputElement).value).toBe('1');
  fireEvent.change(fade, { target: { value: '2' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Total duration (seconds)' }), {
    target: { value: '4' },
  });
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(doc().show!.cues[0]).toMatchObject({
    fadeInSeconds: 2,
    durationSeconds: 4,
    assetId: asset,
  });
});

it('displays missing sources and conflicting saved rules honestly and permits stopping music without a source', async () => {
  const initial = structuredClone(document);
  const base = {
    frameId: initial.nodes[0].id,
    trigger: 'enter',
    action: 'play',
    assetId: crypto.randomUUID(),
    channel: 'music',
  };
  initial.show!.cues = [
    showCueSchema.parse({ ...base, id: crypto.randomUUID() }),
    showCueSchema.parse({ ...base, id: crypto.randomUUID() }),
  ];
  const r = controlledTools(initial);
  expect(
    screen.getAllByRole('button', { name: /This audio file is missing/ }).length
  ).toBeGreaterThan(0);
  await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
  expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  await choose('Action', 'Stop current music');
  expect(screen.queryByRole('combobox', { name: 'Music or sound' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  const next = structuredClone(initial);
  next.show!.cues = [
    showCueSchema.parse({
      id: crypto.randomUUID(),
      frameId: next.nodes[0].id,
      trigger: 'activate',
      action: 'stop',
    }),
  ];
  r.replace(next);
  expect(screen.getByRole('button', { name: /Stop current music/ })).toBeTruthy();
});

it.each(['empty', 'error'] as const)(
  'keeps an audio upload failure visible when its result is %s',
  async outcome => {
    render(
      <Harness
        upload={async () => {
          if (outcome === 'error') throw new Error('upload unavailable');
          return undefined;
        }}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Add music' }));
    const input = screen.getByLabelText('Upload audio', { selector: 'input' });
    fireEvent.change(input, {
      target: { files: [new File(['audio'], 'sound.wav', { type: 'audio/wav' })] },
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(commits).not.toHaveBeenCalled();
  }
);

it('uploads background video, rejects a wrong file and commits its intensity only on confirmation', async () => {
  render(
    <Harness upload={async () => ({ id: 'new-video', name: 'Fresh.mp4', mime: 'video/mp4' })} />
  );
  await user.click(
    within(screen.getByRole('region', { name: 'Animations' })).getAllByRole('button', {
      name: 'Edit',
    })[0]
  );
  const intensity = screen.getByRole('slider');
  fireEvent.keyDown(intensity, { key: 'ArrowRight' });
  await user.click(screen.getByRole('button', { name: 'Own video' }));
  const input = screen.getByLabelText('Upload video', { selector: 'input' });
  fireEvent.change(input, {
    target: { files: [new File(['wrong'], 'wrong.wav', { type: 'audio/wav' })] },
  });
  expect(await screen.findByRole('alert')).toBeTruthy();
  fireEvent.change(input, {
    target: { files: [new File(['video'], 'fresh.mp4', { type: 'video/mp4' })] },
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false)
  );
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect((doc().nodes[0] as any).intro).toMatchObject({
    mode: 'video',
    assetId: 'new-video',
    intensity: 0.5,
  });
});

it('commits element duration and intensity only after confirmation', async () => {
  render(<Harness />);
  const node = document.nodes.find(node => node.type === 'richText')!;
  await user.click(screen.getByRole('button', { name: `Edit animation: ${node.name}` }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Duration (seconds)' }), {
    target: { value: '2' },
  });
  fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(doc().nodes.find(n => n.id === node.id)?.showAnimation).toMatchObject({
    duration: 2,
    intensity: 0.55,
  });
});

it('previews the real selected music and transition cues, bounds animation frames and pauses hidden output', async () => {
  PreviewAudio.instances = [];
  vi.stubGlobal('Audio', PreviewAudio);
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  const initial = structuredClone(document);
  initial.show!.cues = [
    showCueSchema.parse({
      id: crypto.randomUUID(),
      frameId: initial.nodes[0].id,
      trigger: 'enter',
      builtin: 'cinematic-hope',
    }),
    showCueSchema.parse({
      id: crypto.randomUUID(),
      frameId: initial.nodes[0].id,
      channel: 'transition',
      trigger: 'enter',
      builtin: 'test-tone',
    }),
  ];
  controlledTools(initial, { portrait: true });
  await user.click(screen.getByRole('button', { name: 'Preview slide' }));
  await user.click(screen.getByRole('checkbox', { name: 'Include audio' }));
  await user.click(screen.getByRole('button', { name: 'Simulate slide change' }));
  expect(PreviewAudio.instances.some(audio => audio.src.startsWith('/audio/'))).toBe(true);
  act(() => {
    const callback = [...frames.values()][0];
    frames.clear();
    callback(performance.now() + 100);
  });
  expect(frames.size).toBe(1);
  act(() => {
    const callback = [...frames.values()][0];
    frames.clear();
    callback(1);
  });
  expect(frames.size).toBe(1);
  await user.click(screen.getByRole('button', { name: 'Pause' }));
  await user.click(screen.getByRole('button', { name: 'Start' }));
  expect(PreviewAudio.instances).toHaveLength(6);
  Object.defineProperty(window.document, 'hidden', { value: true, configurable: true });
  act(() => window.document.dispatchEvent(new Event('visibilitychange')));
  expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
  expect(PreviewAudio.instances.every(audio => audio.src === '')).toBe(true);
  delete (window.document as any).hidden;
});

it('rebases background and element removal on the latest document without resurrecting remotely deleted targets', async () => {
  const initial = structuredClone(document);
  const r = controlledTools(initial);
  const deleted = structuredClone(initial);
  deleted.nodes = [];
  r.rebase(deleted);
  await user.click(screen.getByRole('button', { name: 'Remove background animation' }));
  expect(r.current().nodes).toEqual([]);
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(r.current().nodes).toEqual([]);
  const node = initial.nodes.find(node => node.type === 'richText')!;
  await user.click(screen.getByRole('button', { name: `Remove animation: ${node.name}` }));
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(r.current().nodes).toEqual([]);
});

it('rebases rule removal and undo without duplicating a concurrently restored rule', async () => {
  const initial = structuredClone(document);
  const cue = showCueSchema.parse({
    id: crypto.randomUUID(),
    frameId: initial.nodes[0].id,
    trigger: 'enter',
    builtin: 'cinematic-hope',
  });
  initial.show!.cues = [cue];
  const r = controlledTools(initial);
  const absent = structuredClone(initial);
  delete absent.show;
  r.rebase(absent);
  await user.click(
    within(screen.getByRole('region', { name: 'Slide music' })).getByRole('button', {
      name: 'Remove',
    })
  );
  expect(r.current().show).toBeUndefined();
  r.rebase(initial);
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(r.current().show!.cues).toEqual([cue]);
});

it('keeps an in-progress upload cancellation from assigning late failures to a new editor', async () => {
  let reject!: (failure: Error) => void;
  render(
    <Harness
      upload={() =>
        new Promise((_resolve, fail) => {
          reject = fail;
        })
      }
    />
  );
  await user.click(screen.getByRole('button', { name: 'Add music' }));
  fireEvent.change(screen.getByLabelText('Upload audio', { selector: 'input' }), {
    target: { files: [new File(['audio'], 'sound.wav', { type: 'audio/wav' })] },
  });
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Add transition sound' }));
  await act(async () => reject(new Error('cancelled request')));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(commits).not.toHaveBeenCalled();
});

it('shows a real uploaded track duration after metadata arrives and leaves nonfinite metadata unavailable', async () => {
  PreviewAudio.instances = [];
  vi.stubGlobal('Audio', PreviewAudio);
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Add music' }));
  await choose('Music or sound', 'My sound');
  const metadata = PreviewAudio.instances.at(-1)!;
  metadata.duration = Infinity;
  act(() => metadata.dispatchEvent(new Event('loadedmetadata')));
  expect(screen.getByText('Duration available after loading')).toBeTruthy();
  metadata.duration = 61;
  act(() => metadata.dispatchEvent(new Event('loadedmetadata')));
  expect(screen.getByText('Track duration: 1:01')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(metadata.src).toBe('');
});
it('keeps detached animation drafts local when their remote target or an open choice disappears', async () => {
  const initial = structuredClone(document);
  const r = controlledTools(initial);
  await user.click(screen.getByRole('button', { name: 'Add element animation' }));
  const target = initial.nodes.find(
    n => n.name === screen.getByRole('combobox', { name: 'Element' }).textContent
  )!;
  await user.click(screen.getByRole('combobox', { name: 'Element' }));
  const replacement = initial.nodes.find(n => n.type !== 'frame' && n.id !== target.id)!;
  initial.nodes = initial.nodes.filter(n => n.id !== replacement.id);
  await user.click(
    within(await screen.findByRole('listbox')).getByRole('option', { name: replacement.name })
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
  const withoutTarget = structuredClone(initial);
  withoutTarget.nodes = withoutTarget.nodes.filter(n => n.id !== target.id);
  r.replace(withoutTarget);
  expect(screen.getByRole('dialog')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(r.current().nodes.some(n => n.id === target.id)).toBe(false);
});

it('handles a saved cue whose frame disappears while keeping the current slide selectable', async () => {
  const initial = structuredClone(document);
  const cue = showCueSchema.parse({
    id: crypto.randomUUID(),
    frameId: speech.nodes[0].id,
    channel: 'transition',
    trigger: 'enter',
    assetId: asset,
  });
  delete cue.durationSeconds;
  initial.show!.cues = [cue];
  const r = controlledTools(initial);
  await user.click(screen.getByRole('button', { name: 'Expand: Debate' }));
  await user.click(
    within(screen.getAllByRole('region', { name: 'Transition sounds' })[1]).getByRole('button', {
      name: 'Edit',
    })
  );
  expect(
    (screen.getByRole('spinbutton', { name: 'Total duration (seconds)' }) as HTMLInputElement).value
  ).toBe('3');
  const next = structuredClone(initial);
  next.nodes = next.nodes.filter(
    n => n.id !== speech.nodes[0].id && n.parentFrameId !== speech.nodes[0].id
  );
  r.replace(next);
  expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getAllByText('Slide 0 · Opening')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(commits).not.toHaveBeenCalled();
});

it.each(['pause', 'stop'] as const)(
  'previews a saved %s command with uploaded audio and global slide transitions',
  async action => {
    PreviewAudio.instances = [];
    vi.stubGlobal('Audio', PreviewAudio);
    const initial = structuredClone(document);
    initial.show!.cues = [
      showCueSchema.parse({
        id: crypto.randomUUID(),
        frameId: initial.nodes[0].id,
        trigger: 'enter',
        action,
        assetId: asset,
      }),
      showCueSchema.parse({
        id: crypto.randomUUID(),
        scope: 'global',
        channel: 'transition',
        trigger: 'enter',
        assetId: asset,
      }),
    ];
    controlledTools(initial);
    await user.click(screen.getByRole('button', { name: 'Preview slide' }));
    await user.click(screen.getByRole('checkbox', { name: 'Include audio' }));
    await user.click(screen.getByRole('button', { name: 'Simulate slide change' }));
    expect(PreviewAudio.instances.some(a => a.src === `/api/studio/media/${asset}`)).toBe(true);
    act(() => window.document.dispatchEvent(new Event('visibilitychange')));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: 'Include audio' }));
    expect(PreviewAudio.instances.every(a => a.src === '')).toBe(true);
  }
);

it('previews silent projects without a cue collection and lets a transition be listened to independently', async () => {
  PreviewAudio.instances = [];
  vi.stubGlobal('Audio', PreviewAudio);
  const initial = structuredClone(document);
  delete initial.show;
  const r = controlledTools(initial);
  await user.click(screen.getByRole('button', { name: 'Preview slide' }));
  await user.click(screen.getByRole('checkbox', { name: 'Include audio' }));
  await user.click(screen.getByRole('button', { name: 'Start' }));
  expect(PreviewAudio.instances).toHaveLength(6);
  expect(
    PreviewAudio.instances.every(
      a => !a.src.includes('/api/studio/media/') && !a.src.startsWith('/audio/')
    )
  ).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Add transition sound' }));
  await choose('Music or sound', 'My sound');
  await user.click(screen.getByRole('button', { name: 'Listen' }));
  await waitFor(() =>
    expect(PreviewAudio.instances.some(a => a.src === `/api/studio/media/${asset}`)).toBe(true)
  );
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(r.current().show).toBeUndefined();
});

it('ignores browser activation finishing after the listening editor has closed', async () => {
  const resolve: (() => void)[] = [];
  class DelayedAudio extends PreviewAudio {
    override play = vi.fn(() => new Promise<void>(done => resolve.push(done)));
  }
  PreviewAudio.instances = [];
  vi.stubGlobal('Audio', DelayedAudio);
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Add music' }));
  await choose('Music or sound', /Test sound/);
  await user.click(screen.getByRole('button', { name: 'Listen' }));
  expect(resolve).toHaveLength(6);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await act(async () => {
    resolve.forEach(done => done());
  });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(PreviewAudio.instances.every(a => a.src === '')).toBe(true);
});

it('opens a background for a plain slide and keeps element defaults when selection rebases the animation', async () => {
  const initial = structuredClone(document);
  const frame = initial.nodes[0];
  if (frame.type !== 'frame') throw new Error('Expected frame');
  delete frame.intro;
  delete frame.eventSource;
  const r = controlledTools(initial, {
    onSelect: node => {
      delete node.showAnimation;
    },
  });
  await user.click(screen.getByRole('button', { name: 'Add background animation' }));
  expect(screen.getByRole('button', { name: 'Architecture' }).getAttribute('aria-pressed')).toBe(
    'true'
  );
  await user.click(screen.getByRole('button', { name: 'Save' }));
  const saved = r.current().nodes[0];
  expect(saved.type === 'frame' && saved.intro?.mode).toBe('spatial');
  const node = initial.nodes.find(n => n.type === 'richText')!;
  await user.click(screen.getByRole('button', { name: `Edit animation: ${node.name}` }));
  expect(
    (screen.getByRole('spinbutton', { name: 'Duration (seconds)' }) as HTMLInputElement).value
  ).toBe('0.8');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(r.current().nodes.find(n => n.id === node.id)?.showAnimation).toMatchObject({
    preset: 'fade',
    duration: 0.8,
  });
});

it('reports a real audio decode error and clears it when the source is edited', async () => {
  PreviewAudio.instances = [];
  vi.stubGlobal('Audio', PreviewAudio);
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Add music' }));
  await choose('Music or sound', 'My sound');
  await user.click(screen.getByRole('button', { name: 'Listen' }));
  await waitFor(() =>
    expect(PreviewAudio.instances.some(a => a.src === `/api/studio/media/${asset}`)).toBe(true)
  );
  act(() => {
    for (const audio of PreviewAudio.instances.filter(a => a.src)) {
      Object.defineProperty(audio, 'error', { value: { code: 3 }, configurable: true });
      audio.dispatchEvent(new Event('error'));
    }
  });
  expect(screen.getByRole('alert').textContent).toContain('Preview could not play');
  await choose('Music or sound', /Test sound/);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('uses the linked agenda source to save an enabled live trigger', async () => {
  const initial = structuredClone(speech);
  const frame = initial.nodes[0];
  if (frame.type !== 'frame' || !frame.eventSource) throw new Error('Expected linked agenda frame');
  const r = controlledTools(initial, {
    sources: [
      {
        source_type: 'agenda_item',
        source_id: frame.eventSource.id,
        payload: { results: { title: 'Decision', status: 'active', eligible: 1, options: [] } },
      },
    ],
  });
  await user.click(screen.getByRole('button', { name: 'Add music' }));
  await choose('When', 'Activate agenda item');
  await choose('Music or sound', /Test sound/);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(r.current().show!.cues[0]).toMatchObject({ trigger: 'activate', frameId: frame.id });
});

it('shows the slide context and commits add/edit once, with source and target fully editable', async () => {
  render(<Harness />);
  expect(screen.getAllByText('Slide 1 · Opening')).toHaveLength(1);
  const music = within(screen.getByRole('region', { name: 'Slide music' }));
  await user.click(music.getByRole('button', { name: 'Add music' }));
  let editor = within(screen.getByRole('dialog', { name: 'Edit slide music' }));
  expect(editor.getByRole('button', { name: 'Save' }).matches(':disabled')).toBe(true);
  await choose('Music or sound', /Cinematic opening/);
  expect(doc().show!.cues).toHaveLength(0);
  await user.click(editor.getByRole('button', { name: 'Save' }));
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
  expect(music.getByRole('button', { name: /When slide “Opening” is shown/ })).toBeTruthy();
  await user.click(music.getByRole('button', { name: 'Edit' }));
  editor = within(screen.getByRole('dialog', { name: 'Edit slide music' }));
  await choose('Music or sound', 'My sound');
  await choose('Target slide', /Debate/);
  fireEvent.keyDown(editor.getByRole('slider', { name: /^Volume/ }), { key: 'End' });
  fireEvent.change(editor.getByRole('spinbutton', { name: 'Fade out (seconds)' }), {
    target: { value: '2' },
  });
  expect(commits).toHaveBeenCalledTimes(1);
  await user.click(editor.getByRole('button', { name: 'Save' }));
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
}, 15_000);
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
  await user.click(screen.getByRole('button', { name: 'Add music' }));
  await choose('Music or sound', /Eternal Hope/);
  expect(screen.getByRole('alert').textContent).toContain('Another rule');
  expect(screen.getByRole('button', { name: 'Save' }).matches(':disabled')).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(commits).not.toHaveBeenCalled();
  const music = within(screen.getByRole('region', { name: 'Slide music' }));
  await user.click(music.getByRole('button', { name: 'Remove' }));
  expect(doc().show!.cues).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(doc().show!.cues).toEqual(initial.show!.cues);
});
it('creates a global transition, preserves it on other slides and disables test tone looping', async () => {
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Add transition sound' }));
  await choose('Applies to', 'All slide changes');
  await choose('Music or sound', /Test sound/);
  expect(screen.queryByRole('checkbox', { name: 'Repeat music' })).toBeNull();
  expect(
    (screen.getByRole('spinbutton', { name: 'Total duration (seconds)' }) as HTMLInputElement)
      .valueAsNumber
  ).toBe(3);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  const cue = doc().show!.cues[0];
  expect(cue).toMatchObject({
    scope: 'global',
    channel: 'transition',
    builtin: 'test-tone',
    loop: false,
    durationSeconds: 3,
  });
  expect(cue.frameId).toBeUndefined();
  await user.click(screen.getByRole('button', { name: 'Next slide' }));
  expect(screen.getByRole('button', { name: /On every slide change/ })).toBeTruthy();
});
it('edits background scenes as drafts, preserves cover content and removes the fallback explicitly', async () => {
  render(<Harness />);
  const before = JSON.stringify(doc().nodes.slice(1));
  await user.click(
    within(screen.getByRole('region', { name: 'Animations' })).getAllByRole('button', {
      name: 'Edit',
    })[0]
  );
  await user.click(screen.getByRole('button', { name: 'Democracy — 3D' }));
  expect(commits).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect((doc().nodes[0] as any).intro.scene).toBe('democracy-sculptural');
  expect(JSON.stringify(doc().nodes.slice(1))).toBe(before);
  await user.click(screen.getByRole('button', { name: 'Remove background animation' }));
  expect((doc().nodes[0] as any).intro).toMatchObject({ mode: 'static', assetId: null });
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  expect((doc().nodes[0] as any).intro).toMatchObject({
    mode: 'spatial',
    scene: 'democracy-sculptural',
  });
});
it('supports source-free pause rules and marks missing files rather than saving an invalid source', async () => {
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Add music' }));
  await choose('Action', 'Pause current music');
  expect(screen.queryByRole('combobox', { name: 'Music or sound' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Save' }));
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
  await user.click(screen.getByRole('button', { name: 'Slide 2 · Debate' }));
  const nextNode = speech.nodes.find(n => n.type === 'richText')!;
  const nextRow = screen.getByRole('tree').querySelector(`[data-show-layer-id="${nextNode.id}"]`)!;
  await user.click(within(nextRow as HTMLElement).getByRole('button', { name: nextNode.name }));
  expect(nextRow.getAttribute('aria-selected')).toBe('true');
  expect(firstRow.getAttribute('aria-selected')).toBe('false');
  await user.click(
    within(nextRow as HTMLElement).getByRole('button', { name: `Edit animation: ${nextNode.name}` })
  );
  expect(within(screen.getByRole('dialog')).getByText('Slide 2 · Debate')).toBeTruthy();
});
it('reuses the image dropzone for audio, validates files and only saves the new source on confirmation', async () => {
  const uploaded = { id: crypto.randomUUID(), name: 'Intro.mp3', mime: 'audio/mpeg' };
  const upload = vi.fn(async () => uploaded);
  render(<Harness upload={upload} />);
  await user.click(screen.getByRole('button', { name: 'Add music' }));
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
  await user.click(screen.getByRole('button', { name: 'Save' }));
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
  await user.click(screen.getByRole('button', { name: 'Add music' }));
  fireEvent.drop(screen.getByTestId('studio-audio-dropzone'), {
    dataTransfer: { files: [new File(['a'], 'Intro.wav', { type: 'audio/wav' })] },
  });
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Add transition sound' }));
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
  await user.click(within(row).getByRole('button', { name: `Remove animation: ${animated.name}` }));
  expect(tree.querySelector(`[data-show-layer-id="${animated.id}"]`)).toBeNull();
  expect(doc().nodes.some(n => n.id === animated.id)).toBe(true);
  expect(screen.getAllByText('Slide 1 · Opening')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Add element animation' }));
  expect(screen.getByRole('combobox', { name: 'Element' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
});

it('keeps the upload draft open while the editor becomes temporarily busy', async () => {
  let finish!: (asset: { id: string; name: string; mime: string }) => void;
  const upload = () =>
    new Promise<{ id: string; name: string; mime: string }>(resolve => {
      finish = resolve;
    });
  const view = render(<Harness upload={upload} />);
  await user.click(screen.getByRole('button', { name: 'Add music' }));
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
  await user.click(screen.getByRole('button', { name: 'Save' }));
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
    await user.click(screen.getByRole('button', { name: 'Add music' }));
    await choose('Music or sound', /Test sound/);
    await user.click(screen.getByRole('button', { name: 'Listen' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Preview could not play');
    expect(alert.querySelector('[class*="badge-danger"]')).not.toBeNull();
    await choose('Music or sound', /Eternal Hope/);
    expect(screen.queryByRole('alert')).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});

async function keyboardButton(button: HTMLElement) {
  button.focus();
  expect(window.document.activeElement).toBe(button);
  await user.keyboard('{Enter}');
}
async function keyboardChoice(label: string, option: string | RegExp) {
  const trigger = screen.getByLabelText(label, { selector: 'button[role="combobox"]' });
  await keyboardButton(trigger);
  const choices = within(await screen.findByRole('listbox'));
  const choice = choices.getByRole('option', { name: option });
  if (label === 'When') {
    expect(
      choices.getAllByRole('option').some(item => item.getAttribute('aria-disabled') === 'true')
    ).toBe(true);
  }
  choice.focus();
  expect(window.document.activeElement).toBe(choice);
  await user.keyboard('{Enter}');
  expect(window.document.activeElement).toBe(trigger);
}

it('edits music and global transition rules through focused keyboard controls and preserves local drafts', async () => {
  render(<Harness />);
  await keyboardButton(screen.getByRole('button', { name: 'Add music' }));
  await keyboardChoice('When', 'Show frame');
  await keyboardChoice('Target slide', /Debate/);
  await keyboardChoice('Action', 'Pause current music');
  expect(screen.queryByRole('combobox', { name: 'Music or sound' })).toBeNull();
  await keyboardChoice('Action', 'Play music');
  await keyboardChoice('Music or sound', /Eternal Hope/);
  const repeat = screen.getByRole('checkbox', { name: 'Repeat music' });
  repeat.focus();
  expect(window.document.activeElement).toBe(repeat);
  expect(repeat.getAttribute('aria-checked')).toBe('true');
  await user.keyboard(' ');
  expect(repeat.getAttribute('aria-checked')).toBe('false');
  await user.keyboard(' ');
  expect(repeat.getAttribute('aria-checked')).toBe('true');
  await keyboardChoice('Music or sound', /Test sound/);
  expect(
    (screen.getByRole('checkbox', { name: 'Repeat music' }) as HTMLButtonElement).disabled
  ).toBe(true);
  expect(screen.getByRole('checkbox', { name: 'Repeat music' }).getAttribute('aria-checked')).toBe(
    'false'
  );
  await keyboardChoice('Music or sound', /Eternal Hope/);
  expect(commits).not.toHaveBeenCalled();
  await keyboardButton(screen.getByRole('button', { name: 'Save' }));
  expect(doc().show!.cues[0]).toMatchObject({
    frameId: speech.nodes[0].id,
    action: 'play',
    loop: true,
  });
  await keyboardButton(screen.getByRole('button', { name: 'Add sound for all slide changes' }));
  await keyboardChoice('Applies to', 'This slide');
  await keyboardChoice('Applies to', 'All slide changes');
  expect((screen.getByRole('combobox', { name: 'When' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('combobox', { name: 'Action' }) as HTMLButtonElement).disabled).toBe(
    true
  );
  await keyboardChoice('Music or sound', /Test sound/);
  await keyboardButton(screen.getByRole('button', { name: 'Save' }));
  expect(doc().show!.cues.at(-1)).toMatchObject({
    scope: 'global',
    builtin: 'test-tone',
    channel: 'transition',
  });
}, 30000);

it('selects and collapses slide layers and operates preview controls through keyboard focus', async () => {
  render(<Harness />);
  await keyboardButton(screen.getByRole('button', { name: 'Collapse: Opening' }));
  expect(screen.queryByRole('button', { name: 'Add music' })).toBeNull();
  await keyboardButton(screen.getByRole('button', { name: 'Expand: Opening' }));
  await keyboardButton(screen.getByRole('button', { name: 'Slide 2 · Debate' }));
  const node = speech.nodes.find(n => n.type === 'richText')!;
  await keyboardButton(within(screen.getByRole('tree')).getByRole('button', { name: node.name }));
  expect(
    screen
      .getByRole('tree')
      .querySelector(`[data-show-layer-id="${node.id}"]`)
      ?.getAttribute('aria-selected')
  ).toBe('true');
  await keyboardButton(screen.getByRole('button', { name: 'Preview slide' }));
  const audio = screen.getByRole('checkbox', { name: 'Include audio' });
  audio.focus();
  expect(window.document.activeElement).toBe(audio);
  await user.keyboard(' ');
  expect(audio.getAttribute('aria-checked')).toBe('true');
  await user.keyboard(' ');
  expect(audio.getAttribute('aria-checked')).toBe('false');
  await keyboardButton(screen.getByRole('button', { name: 'Start' }));
  expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  await keyboardButton(screen.getByRole('button', { name: 'Pause' }));
  expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
  await keyboardButton(screen.getByRole('button', { name: 'Replay' }));
  expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  await keyboardButton(screen.getByRole('button', { name: 'Simulate slide change' }));
  await keyboardButton(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(commits).not.toHaveBeenCalled();
}, 30000);

it('edits background video and element animation choices using keyboard without committing cancelled drafts', async () => {
  render(<Harness />);
  await keyboardButton(
    within(screen.getByRole('region', { name: 'Animations' })).getAllByRole('button', {
      name: 'Edit',
    })[0]
  );
  await keyboardButton(screen.getByRole('button', { name: 'Democracy — Illustration' }));
  expect(
    screen.getByRole('button', { name: 'Democracy — Illustration' }).getAttribute('aria-pressed')
  ).toBe('true');
  await keyboardButton(screen.getByRole('button', { name: 'Own video' }));
  await keyboardChoice('Background video', 'Opening.mp4');
  await keyboardButton(screen.getByRole('button', { name: 'Static' }));
  expect(screen.getByRole('button', { name: 'Static' }).getAttribute('aria-pressed')).toBe('true');
  await keyboardButton(screen.getByRole('button', { name: 'Cancel' }));
  expect(commits).not.toHaveBeenCalled();
  await keyboardButton(screen.getByRole('button', { name: 'Add element animation' }));
  const target = document.nodes.find(n => n.type !== 'frame' && n.type !== 'richText')!;
  await keyboardChoice('Element', target.name);
  await keyboardChoice('Effect', 'Pulse');
  await keyboardButton(screen.getByRole('button', { name: 'Save' }));
  expect(doc().nodes.find(n => n.id === target.id)?.showAnimation?.preset).toBe('pulse');
}, 30000);

it('links music credits directly to external sources and licenses', async () => {
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Add music' }));
  await choose('Music or sound', /Eternal Hope/);
  const links = within(screen.getByRole('dialog')).getAllByRole('link');
  expect(links.length).toBeGreaterThanOrEqual(2);
  for (const link of links) {
    expect(link.getAttribute('href')).toMatch(/^https:\/\//);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noreferrer');
    const clicked = vi.fn((event: Event) => event.preventDefault());
    link.addEventListener('click', clicked);
    link.focus();
    expect(window.document.activeElement).toBe(link);
    await user.keyboard('{Enter}');
    expect(clicked).toHaveBeenCalledOnce();
  }
}, 30000);

it('opens saved music rules with keyboard and disables their editing when access is revoked', async () => {
  const initial = structuredClone(document);
  initial.show!.cues = [
    showCueSchema.parse({
      id: crypto.randomUUID(),
      frameId: initial.nodes[0].id,
      builtin: 'test-tone',
      trigger: 'enter',
    }),
  ];
  const view = render(<Harness initial={initial} />);
  const rule = screen.getByRole('button', { name: /When slide “Opening” is shown/ });
  await keyboardButton(rule);
  expect(screen.getByRole('dialog', { name: 'Edit slide music' })).toBeTruthy();
  await keyboardButton(screen.getByRole('button', { name: 'Cancel' }));
  const region = within(screen.getByRole('region', { name: 'Slide music' }));
  await keyboardButton(region.getByRole('button', { name: 'Edit' }));
  expect(screen.getByRole('dialog', { name: 'Edit slide music' })).toBeTruthy();
  await keyboardButton(screen.getByRole('button', { name: 'Cancel' }));
  await keyboardButton(region.getByRole('button', { name: 'Remove' }));
  expect(doc().show!.cues).toHaveLength(0);
  await keyboardButton(screen.getByRole('button', { name: 'Undo' }));
  expect(doc().show!.cues).toEqual(initial.show!.cues);
  view.rerender(<Harness initial={initial} disabled />);
  expect(
    (screen.getByRole('button', { name: /When slide “Opening” is shown/ }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  expect((region.getByRole('button', { name: 'Edit' }) as HTMLButtonElement).disabled).toBe(true);
  expect((region.getByRole('button', { name: 'Remove' }) as HTMLButtonElement).disabled).toBe(true);
  for (const name of [
    'Add music',
    'Add transition sound',
    'Add element animation',
    'Add sound for all slide changes',
    'Remove background animation',
  ]) {
    expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
  }
}, 30000);

it('adds, edits, removes and restores background and element animations with native keyboard controls', async () => {
  render(<Harness />);
  await keyboardButton(screen.getByRole('button', { name: 'Remove background animation' }));
  expect((doc().nodes[0] as any).intro.mode).toBe('static');
  await keyboardButton(screen.getByRole('button', { name: 'Add background animation' }));
  await keyboardButton(screen.getByRole('button', { name: 'Save' }));
  expect((doc().nodes[0] as any).intro.mode).toBe('spatial');
  const node = document.nodes.find(n => n.type === 'richText')!;
  await keyboardButton(screen.getByRole('button', { name: `Edit animation: ${node.name}` }));
  await keyboardChoice('Effect', 'Pulse');
  await keyboardButton(screen.getByRole('button', { name: 'Save' }));
  expect(doc().nodes.find(n => n.id === node.id)?.showAnimation?.preset).toBe('pulse');
  await keyboardButton(screen.getByRole('button', { name: `Remove animation: ${node.name}` }));
  expect(doc().nodes.find(n => n.id === node.id)?.showAnimation?.preset).toBe('none');
  await keyboardButton(screen.getByRole('button', { name: 'Undo' }));
  expect(doc().nodes.find(n => n.id === node.id)?.showAnimation?.preset).toBe('pulse');
}, 30000);

it('starts and stops local audio through native keyboard focus and disables listening without a source', async () => {
  const NativeAudio = window.Audio;
  const play = vi.fn(async () => undefined);
  vi.stubGlobal('Audio', function () {
    const media = new NativeAudio();
    media.play = play;
    return media;
  });
  try {
    render(<Harness />);
    await keyboardButton(screen.getByRole('button', { name: 'Add music' }));
    expect((screen.getByRole('button', { name: 'Listen' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    await keyboardChoice('Music or sound', /Test sound/);
    await keyboardButton(screen.getByRole('button', { name: 'Listen' }));
    await waitFor(() => expect(play).toHaveBeenCalled());
    await keyboardButton(screen.getByRole('button', { name: 'Stop preview' }));
    expect(screen.getByRole('button', { name: 'Listen' })).toBeTruthy();
  } finally {
    vi.unstubAllGlobals();
  }
}, 30000);

it('blocks local confirmations and background creation when editing access is revoked', async () => {
  const view = render(<Harness />);
  await keyboardButton(screen.getByRole('button', { name: 'Add music' }));
  await keyboardChoice('Music or sound', /Test sound/);
  view.rerender(<Harness disabled />);
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  expect(commits).not.toHaveBeenCalled();
  view.rerender(<Harness />);
  await keyboardButton(screen.getByRole('button', { name: 'Cancel' }));
  await keyboardButton(
    within(screen.getByRole('region', { name: 'Animations' })).getAllByRole('button', {
      name: 'Edit',
    })[0]
  );
  view.rerender(<Harness disabled />);
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  expect(commits).not.toHaveBeenCalled();
  view.rerender(<Harness />);
  await keyboardButton(screen.getByRole('button', { name: 'Own video' }));
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  await keyboardButton(screen.getByRole('button', { name: 'Cancel' }));
  await keyboardButton(screen.getByRole('button', { name: 'Remove background animation' }));
  view.rerender(<Harness disabled />);
  expect(
    (screen.getByRole('button', { name: 'Add background animation' }) as HTMLButtonElement).disabled
  ).toBe(true);
}, 30000);

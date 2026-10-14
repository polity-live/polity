// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createEventTemplate } from '@/features/communication-studio/logic/event-templates';
import { EventPresentation } from '../EventPresentation';
import { EventPresentationLauncher } from '../EventPresentationLauncher';
import {
  presentationMusic,
  presentationMusicCredits,
  presentationSequence,
} from '@/features/communication-studio/logic/presentation-audio';

const mocks = vi.hoisted(() => ({
  show: {} as any,
  command: vi.fn(async (): Promise<void> => undefined),
  export: vi.fn(async () => undefined),
  activate: vi.fn(async () => undefined),
  audioStatus: 'idle',
  audioError: '',
  animatedNull: false,
}));
vi.mock('@/zero/communication-studio/useEventPresentation', () => ({
  useEventPresentation: () => mocks.show,
}));
vi.mock('../../hooks/usePresentationAudio', () => ({
  usePresentationAudio: () => ({
    status: mocks.audioStatus,
    enabled: mocks.audioStatus === 'ready',
    error: mocks.audioError,
    activate: mocks.activate,
  }),
}));
vi.mock('../../hooks/useAnimatedStudioDocument', () => ({
  useAnimatedStudioDocument: (d: unknown) => (mocks.animatedNull ? null : d),
}));
vi.mock('@/features/communication-studio/ui/KonvaStudioCanvas', () => ({
  default: () => <div data-testid="presentation-canvas" />,
}));
afterEach(() => vi.useRealTimers());

function setVolume(value: number) {
  const slider = screen.getByRole('slider');
  fireEvent.keyDown(slider, { key: 'Home' });
  for (let i = 0; i < Math.round(value / 0.05); i++)
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
}

const event = crypto.randomUUID();
const agenda = crypto.randomUUID();
beforeEach(() => {
  vi.clearAllMocks();
  mocks.audioStatus = 'idle';
  mocks.audioError = '';
  mocks.animatedNull = false;
  const document = createEventTemplate('cover', event);
  const frame = document.nodes[0];
  mocks.show = {
    document,
    projected: document,
    project: { id: crypto.randomUUID() },
    state: {
      mode: 'studio',
      frame_id: frame.id,
      running: true,
      results_visible: false,
      audio_device_id: 'screen',
      audio: { status: 'playing', assetId: 'music', position: 10, at: 1000, volume: 0.5 },
      lease_until: 9999999999999,
    },
    deviceId: 'screen',
    online: true,
    connectionChecking: false,
    clockOffset: 0,
    now: 2000,
    page: 0,
    canManage: true,
    hasControl: true,
    assets: [{ id: 'music', name: 'Intro', mime: 'audio/mpeg' }],
    devices: [{ id: 'screen', name: 'Leinwand', last_seen: 2000 }],
    sources: [],
    eventSources: [
      { source_type: 'event', source_id: event, payload: { current_agenda_item_id: agenda } },
      {
        source_type: 'agenda_item',
        source_id: agenda,
        payload: {
          title: 'Opening speech',
          status: 'active',
          order_index: 1,
          start_time: 1800000000000,
          end_time: 1800003600000,
          speakers: [
            { name: 'Ada', completed: false },
            { name: 'Already spoken', completed: true },
          ],
        },
      },
    ],
    command: mocks.command,
    exportSnapshot: mocks.export,
  };
});

it('offers the three event screens and restricts the controller link to managers', async () => {
  const onOpenLiveFocus = vi.fn();
  const r = render(<EventPresentationLauncher eventId={event} onOpenLiveFocus={onOpenLiveFocus} />);
  const trigger = screen.getByRole('button', { name: 'Open live focus' });
  expect(screen.queryByRole('button', { name: 'Present' })).toBeNull();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect((await screen.findByRole('menuitem', { name: 'Agenda' })).getAttribute('href')).toBe(
    `/event/${event}/presentation?mode=agenda`
  );
  expect(screen.getAllByRole('menuitem')).toHaveLength(4);
  r.rerender(
    <EventPresentationLauncher eventId={event} canManage onOpenLiveFocus={onOpenLiveFocus} />
  );
  expect(screen.getAllByRole('menuitem')).toHaveLength(5);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Open live focus' }));
  expect(onOpenLiveFocus).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  fireEvent.keyDown(trigger, { key: 'Enter' });
  const menu = await screen.findByRole('menu');
  fireEvent.keyDown(menu, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
});

it('keeps launcher clicks and pointer presses from activating the surrounding event card', () => {
  const cardClick = vi.fn();
  const cardPointer = vi.fn();
  render(
    <div onClick={cardClick} onPointerDown={cardPointer}>
      <EventPresentationLauncher eventId={event} onOpenLiveFocus={vi.fn()} />
    </div>
  );
  const trigger = screen.getByRole('button', { name: 'Open live focus' });
  fireEvent.pointerDown(trigger, { button: 2 });
  fireEvent.click(trigger);
  expect(cardPointer).not.toHaveBeenCalled();
  expect(cardClick).not.toHaveBeenCalled();
});

it('navigates multiple slides, exports the chosen format and shows an unfinished export honestly', async () => {
  const second = createEventTemplate('speech', crypto.randomUUID());
  second.nodes[0].zIndex = 10;
  mocks.show.projected.nodes.push(...second.nodes);
  mocks.show.state.results_visible = true;
  mocks.show.exportJob = { status: 'queued', progress: 25 };
  const r = render(<EventPresentation eventId={event} regie />);
  await screen.findByTestId('presentation-canvas');
  fireEvent.click(document.querySelector('[data-action-id="event.show.next"]')!);
  expect(mocks.command).toHaveBeenLastCalledWith({
    action: 'control',
    frameId: second.nodes[0].id,
  });
  mocks.show.state.frame_id = second.nodes[0].id;
  r.rerender(<EventPresentation eventId={event} regie />);
  fireEvent.click(document.querySelector('[data-action-id="event.show.previous"]')!);
  expect(mocks.command).toHaveBeenLastCalledWith({
    action: 'control',
    frameId: mocks.show.projected.nodes[0].id,
  });
  fireEvent.change(document.querySelector('[data-action-id="event.show.select2.change"]')!, {
    target: { value: second.nodes[0].id },
  });
  expect(mocks.command).toHaveBeenLastCalledWith({
    action: 'control',
    frameId: second.nodes[0].id,
  });
  fireEvent.change(document.querySelector('[data-action-id="event.show.select3.change"]')!, {
    target: { value: 'png' },
  });
  expect(screen.getByText('queued · 25%')).toBeTruthy();
  mocks.show.exportJob.error = 'Export worker unavailable';
  r.rerender(<EventPresentation eventId={event} regie />);
  expect(screen.getByText('Export worker unavailable')).toBeTruthy();
  fireEvent.click(document.querySelector('[data-action-id="event.show.reveal"]')!);
  expect(mocks.command).toHaveBeenLastCalledWith({ action: 'control', resultsVisible: false });
  fireEvent.change(screen.getByRole('combobox', { name: 'Audio output' }), {
    target: { value: '' },
  });
  await waitFor(() =>
    expect(mocks.command).toHaveBeenLastCalledWith({ action: 'control', audioDeviceId: null })
  );
});

it('sizes portrait speaker pages through the real resize callback and tolerates a queued callback after unmount', () => {
  let resize!: ResizeObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {
        /* Controlled observer remains quiet until the test dispatches it. */
      }
      disconnect = disconnect;
    }
  );
  try {
    mocks.show.eventSources[1].payload.speakers = Array.from({ length: 7 }, (_, i) => ({
      name: `Speaker ${i + 1}`,
      completed: false,
    }));
    const r = render(<EventPresentation eventId={event} initialMode="speakers" />);
    const entry = { contentRect: { width: 400, height: 800 } } as ResizeObserverEntry;
    act(() => resize([entry], {} as ResizeObserver));
    expect(screen.getByText(/Speaker 4/)).toBeTruthy();
    expect(screen.queryByText(/Speaker 5/)).toBeNull();
    r.unmount();
    act(() => resize([entry], {} as ResizeObserver));
    expect(disconnect).toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

it('falls back to a themed static frame while animation initializes and preserves the chosen intro animation', async () => {
  const frame = mocks.show.projected.nodes[0];
  mocks.animatedNull = true;
  frame.intro.mode = 'static';
  delete frame.showAnimation;
  const r = render(<EventPresentation eventId={event} />);
  await screen.findByTestId('presentation-canvas');
  expect(r.container.querySelector('.polity-show-fade')).toBeTruthy();
  delete frame.intro;
  r.rerender(<EventPresentation eventId={event} />);
  expect(r.container.querySelector('.polity-show-none')).toBeTruthy();
  frame.eventSource.template = 'speech';
  r.rerender(<EventPresentation eventId={event} />);
  expect(r.container.querySelector('.polity-show-fade')).toBeTruthy();
});

it('shows safe defaults while show state is unavailable and accepts an empty audio selection without sending it', async () => {
  mocks.show.state = undefined;
  mocks.show.sources = undefined;
  mocks.show.document = null;
  const r = render(<EventPresentation eventId={event} regie />);
  await screen.findByTestId('presentation-canvas');
  const music = screen.getByRole('combobox', { name: 'Music' });
  fireEvent.change(music, { target: { value: '' } });
  expect(mocks.command).not.toHaveBeenCalled();
  fireEvent.click(document.querySelector('[data-action-id="event.show.fullscreen"]')!);
  expect(mocks.activate).not.toHaveBeenCalled();
  fireEvent.click(document.querySelector('[data-action-id="event.show.audio.playing"]')!);
  await waitFor(() => expect(mocks.command).toHaveBeenCalled());
  fireEvent.click(document.querySelector('[data-action-id="event.show.audio.paused"]')!);
  setVolume(0.5);
  r.unmount();
});

it('orders unscheduled agenda items last and renders an empty speaker view when no item is active', () => {
  mocks.show.eventSources[0].payload = { start_time: 1800000000000 };
  mocks.show.eventSources.push({
    source_type: 'agenda_item',
    source_id: crypto.randomUUID(),
    payload: { title: 'Unscheduled', status: 'pending' },
  });
  delete mocks.show.eventSources[1].payload.order_index;
  const r = render(<EventPresentation eventId={event} initialMode="agenda" />);
  expect(screen.getByText('Opening speech')).toBeTruthy();
  r.rerender(<EventPresentation eventId={event} initialMode="speakers" />);
  expect(screen.getByText('Speaker list is empty')).toBeTruthy();
});

it('preserves paused audio choices and reports a rejected volume command without an unhandled promise', async () => {
  mocks.show.state.audio = { assetId: 'music', status: 'paused', position: 4 };
  const r = render(<EventPresentation eventId={event} regie />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Loop' }));
  expect(mocks.command).toHaveBeenLastCalledWith(
    expect.objectContaining({ audio: { status: 'paused', loop: true } })
  );
  mocks.show.state.audio.status = 'stopped';
  r.rerender(<EventPresentation eventId={event} regie />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Loop' }));
  expect(mocks.command).toHaveBeenLastCalledWith(
    expect.objectContaining({ audio: { status: 'stopped', loop: true } })
  );
  mocks.show.state.audio.status = 'playing';
  r.rerender(<EventPresentation eventId={event} regie />);
  fireEvent.click(document.querySelector('[data-action-id="event.show.audio.paused"]')!);
  expect(mocks.command).toHaveBeenLastCalledWith(
    expect.objectContaining({ audio: expect.objectContaining({ position: 4 }) })
  );
  mocks.command.mockRejectedValueOnce(new Error('volume denied'));
  setVolume(0.8);
  await waitFor(() =>
    expect(mocks.command).toHaveBeenCalledWith(
      expect.objectContaining({ audio: expect.objectContaining({ volume: 0.8 }) })
    )
  );
});

it('shares the Live Focus layout and follows the active item with ACL-filtered and revealable results', () => {
  mocks.show.canManage = false;
  const source = mocks.show.eventSources[1];
  source.payload.type = 'vote';
  source.payload.details = 'Discuss this proposal';
  source.payload.result_source_id = 'vote-result';
  source.payload.result_source_type = 'vote';
  // Agenda payloads cannot grant access to a private result.
  source.payload.results = { title: 'Private result' };
  const r = render(<EventPresentation eventId={event} initialMode="agenda" />);
  expect(screen.getByRole('heading', { name: 'Opening speech' })).toBeTruthy();
  expect(screen.getByText('Discuss this proposal')).toBeTruthy();
  expect(screen.getByText('TOP-1')).toBeTruthy();
  expect(screen.queryByText('Ada')).toBeNull();
  expect(screen.queryByRole('complementary')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Show speaker list' })).toBeNull();
  expect(screen.queryByText('Already spoken')).toBeNull();
  expect(screen.queryByText('Private result')).toBeNull();
  expect(document.querySelector('[data-action-id="agendas.live-focus.ballot.cast"]')).toBeNull();
  mocks.show.sources = [
    {
      source_type: 'vote',
      source_id: 'vote-result',
      payload: {
        results: {
          title: 'Mobility funding',
          status: 'closed',
          eligible: 10,
          majority_type: 'simple',
          options: [
            { id: 'yes', label: 'Approve proposal', indicative: 2, final: 6 },
            { id: 'no', label: 'Reject proposal', indicative: 1, final: 4 },
          ],
        },
      },
    },
  ];
  r.rerender(<EventPresentation eventId={event} initialMode="agenda" />);
  expect(screen.queryByText('Mobility funding')).toBeNull();
  expect(screen.getByRole('status')).toBeTruthy();
  mocks.show.state.results_visible = true;
  r.rerender(<EventPresentation eventId={event} initialMode="agenda" />);
  expect(screen.getByText('Mobility funding')).toBeTruthy();
  expect(screen.getByText('Approve proposal')).toBeTruthy();
  expect(screen.getByText('6 · 60%')).toBeTruthy();
  expect(screen.getByText('4 · 40%')).toBeTruthy();
  expect(document.querySelector('[data-slot="vote-results-display"]')).toBeTruthy();
  // Bound sources may repeat the event query; keep TOP numbering and the pre-event spotlight stable.
  mocks.show.sources.push({ ...source });
  mocks.show.eventSources[0].payload.current_agenda_item_id = null;
  source.payload.status = 'pending';
  r.rerender(<EventPresentation eventId={event} initialMode="agenda" />);
  expect(screen.getByText('TOP-1')).toBeTruthy();
  expect(screen.getByText('Mobility funding')).toBeTruthy();
  // Replace the current agenda item without a local user action.
  mocks.show.eventSources.push({
    source_type: 'agenda_item',
    source_id: 'next',
    payload: {
      title: 'Next speech',
      status: 'active',
      type: 'speech',
      order_index: 2,
      speakers: [],
    },
  });
  mocks.show.eventSources[0].payload.current_agenda_item_id = 'next';
  r.rerender(<EventPresentation eventId={event} initialMode="agenda" />);
  expect(screen.getByRole('heading', { name: 'Next speech' })).toBeTruthy();
  expect(screen.getByText('TOP-2')).toBeTruthy();
  expect(screen.queryByText('Mobility funding')).toBeNull();
  mocks.show.eventSources[0].payload.current_agenda_item_id = null;
  source.payload.status = 'completed';
  r.rerender(<EventPresentation eventId={event} initialMode="agenda" />);
  expect(screen.getByRole('heading', { name: 'Next speech' })).toBeTruthy();
  mocks.show.eventSources[2].payload.status = 'completed';
  r.rerender(<EventPresentation eventId={event} initialMode="agenda" />);
  expect(screen.queryByText('Next speech')).toBeNull();
});

it('presents election aggregates through the Live Focus candidate cards without audience actions', () => {
  mocks.show.canManage = false;
  mocks.show.state.results_visible = true;
  const source = mocks.show.eventSources[1];
  source.payload.type = 'election';
  source.payload.result_source_type = 'election';
  source.payload.result_source_id = 'election-result';
  mocks.show.sources = [
    {
      source_type: 'election',
      source_id: 'election-result',
      payload: {
        results: {
          title: 'Chair election',
          status: 'final',
          eligible: 9,
          election_mode: 'single',
          seat_count: 1,
          options: [{ id: 'candidate', label: 'Candidate Ada', indicative: 3, final: 7 }],
        },
      },
    },
  ];
  const r = render(<EventPresentation eventId={event} initialMode="agenda" />);
  expect(screen.getByText('Candidate Ada')).toBeTruthy();
  expect(screen.getByText('7 · 100%')).toBeTruthy();
  expect(document.querySelector('[data-action-id="agendas.election.candidacy.become"]')).toBeNull();
  expect(document.querySelector('[data-action-id="agendas.live-focus.ballot.cast"]')).toBeNull();
  mocks.show.state.results_visible = false;
  r.rerender(<EventPresentation eventId={event} initialMode="agenda" />);
  expect(screen.queryByText('Candidate Ada')).toBeNull();
});

it('tracks actual fullscreen entry, exit and browser Escape without hiding failed requests', async () => {
  let activeElement: Element | null = null;
  const elementDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
  const exitDescriptor = Object.getOwnPropertyDescriptor(document, 'exitFullscreen');
  const change = (element: Element | null) => {
    activeElement = element;
    fireEvent(document, new Event('fullscreenchange'));
  };
  const exit = vi.fn(async () => change(null));
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => activeElement,
  });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
  const r = render(<EventPresentation eventId={event} initialMode="agenda" />);
  const root = r.container.firstElementChild!;
  const enter = vi.fn(async () => change(root));
  Object.defineProperty(root, 'requestFullscreen', { configurable: true, value: enter });
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
    await waitFor(() => expect(mocks.activate).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeTruthy();
    exit.mockRejectedValueOnce(new Error('Exit rejected'));
    fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' }));
    await waitFor(() => expect(exit).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeTruthy());
    expect(mocks.activate).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
    await waitFor(() => expect(mocks.activate).toHaveBeenCalledTimes(2));
    change(null); // Escape and browser UI use the same fullscreenchange event.
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeTruthy();
    enter.mockRejectedValueOnce(new Error('Fullscreen unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
    await waitFor(() => expect(enter).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole('button', { name: 'Exit fullscreen' })).toBeNull();
  } finally {
    r.unmount();
    if (elementDescriptor) Object.defineProperty(document, 'fullscreenElement', elementDescriptor);
    else Reflect.deleteProperty(document, 'fullscreenElement');
    if (exitDescriptor) Object.defineProperty(document, 'exitFullscreen', exitDescriptor);
    else Reflect.deleteProperty(document, 'exitFullscreen');
  }
});

it('auto-hides floating buttons in every view and reveals them on input and fullscreen changes', () => {
  vi.useFakeTimers();
  const r = render(<EventPresentation eventId={event} initialMode="agenda" />);
  const root = r.container.firstElementChild!;
  const toolbar = () => r.container.querySelector('.polity-presentation-buttons')!;
  const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
  expect(toolbar().getAttribute('data-visible')).toBe('true');
  tick(2999);
  expect(toolbar().getAttribute('data-visible')).toBe('true');
  tick(1);
  expect(toolbar().getAttribute('data-visible')).toBe('false');
  fireEvent.pointerMove(root);
  expect(toolbar().getAttribute('data-visible')).toBe('true');
  tick(2000);
  fireEvent.pointerMove(root);
  tick(2000);
  expect(toolbar().getAttribute('data-visible')).toBe('true');
  fireEvent.pointerLeave(root);
  expect(toolbar().getAttribute('data-visible')).toBe('false');
  fireEvent.pointerEnter(root);
  expect(toolbar().getAttribute('data-visible')).toBe('true');
  fireEvent.blur(window);
  expect(toolbar().getAttribute('data-visible')).toBe('false');
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(toolbar().getAttribute('data-visible')).toBe('true');
  tick(3000);
  fireEvent(document, new Event('fullscreenchange'));
  expect(toolbar().getAttribute('data-visible')).toBe('true');
  mocks.show.online = false;
  for (const mode of ['studio', 'speakers', 'agenda'] as const) {
    r.rerender(<EventPresentation eventId={event} initialMode={mode} />);
    tick(3000);
    expect(toolbar().getAttribute('data-visible')).toBe('false');
    expect(screen.getByText('Connection lost').closest('.polity-presentation-buttons')).toBeNull();
    fireEvent.pointerMove(root);
  }
  r.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('pins buttons for hover, keyboard focus and the open control panel, then restarts inactivity', () => {
  vi.useFakeTimers();
  const r = render(<EventPresentation eventId={event} initialMode="agenda" />);
  const root = r.container.firstElementChild!;
  const toolbar = r.container.querySelector('.polity-presentation-buttons')!;
  const tick = () => act(() => vi.advanceTimersByTime(5000));
  fireEvent.pointerEnter(toolbar);
  tick();
  expect(toolbar.getAttribute('data-visible')).toBe('true');
  fireEvent.pointerLeave(toolbar);
  tick();
  expect(toolbar.getAttribute('data-visible')).toBe('false');
  const fullscreen = screen.getByRole('button', { name: 'Fullscreen' });
  fireEvent.keyDown(document, { key: 'Tab' });
  act(() => fullscreen.focus());
  tick();
  fireEvent.pointerLeave(root);
  expect(toolbar.getAttribute('data-visible')).toBe('true');
  act(() => fullscreen.blur());
  tick();
  expect(toolbar.getAttribute('data-visible')).toBe('false');
  fireEvent.pointerMove(root);
  fireEvent.click(screen.getByRole('button', { name: 'Show controls' }));
  tick();
  fireEvent.pointerLeave(root);
  fireEvent.blur(window);
  expect(toolbar.getAttribute('data-visible')).toBe('true');
  expect(r.container.querySelector('aside')).toBeTruthy();
  // Pointer focus must not pin the buttons indefinitely after closing the panel.
  const controls = screen.getByRole('button', { name: 'Show controls' });
  fireEvent.pointerDown(controls);
  act(() => controls.focus());
  fireEvent.click(controls);
  expect(r.container.querySelector('aside')).toBeNull();
  act(() => vi.advanceTimersByTime(2999));
  expect(toolbar.getAttribute('data-visible')).toBe('true');
  act(() => vi.advanceTimersByTime(1));
  expect(toolbar.getAttribute('data-visible')).toBe('false');
  r.unmount();
});

it('uses the first hidden touch only to reveal buttons and lets the next gesture operate normally', async () => {
  vi.useFakeTimers();
  const r = render(<EventPresentation eventId={event} initialMode="agenda" />);
  const root = r.container.firstElementChild!;
  const toolbar = r.container.querySelector('.polity-presentation-buttons')!;
  const pointer = (target: Element, name: string, pointerType = 'touch') => {
    const event = new Event(name, { bubbles: name !== 'pointerenter', cancelable: true });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    fireEvent(target, event);
  };
  act(() => vi.advanceTimersByTime(3000));
  pointer(root, 'pointerenter');
  expect(toolbar.getAttribute('data-visible')).toBe('false');
  pointer(root, 'pointerleave');
  pointer(toolbar, 'pointerenter');
  pointer(toolbar, 'pointerleave');
  fireEvent.keyDown(document.body, { key: 'Escape' });
  expect(toolbar.getAttribute('data-visible')).toBe('false');
  // A stale control target also must not receive the reveal gesture's click.
  const controls = screen.getByRole('button', { name: 'Show controls' });
  pointer(controls, 'pointerdown');
  fireEvent.click(controls);
  expect(toolbar.getAttribute('data-visible')).toBe('true');
  expect(r.container.querySelector('aside')).toBeNull();
  pointer(controls, 'pointerdown');
  fireEvent.click(controls);
  expect(r.container.querySelector('aside')).toBeTruthy();
  fireEvent.click(controls);
  act(() => vi.advanceTimersByTime(3000));
  pointer(root, 'pointerdown');
  pointer(root, 'pointercancel');
  // Cancelled scroll gestures cannot swallow a later normal click.
  fireEvent.click(controls);
  expect(r.container.querySelector('aside')).toBeTruthy();
  r.unmount();
});

it('renders audience screens without management controls and handles loading and reconnecting', async () => {
  mocks.show.canManage = false;
  const r = render(<EventPresentation eventId={event} regie initialMode="agenda" />);
  expect(screen.getByText('Opening speech')).toBeTruthy();
  expect(document.querySelector('[data-action-id="event.show.claim"]')).toBeNull();
  r.rerender(<EventPresentation eventId={event} regie initialMode="speakers" />);
  expect(screen.getByText(/Ada/)).toBeTruthy();
  expect(screen.queryByText('Already spoken')).toBeNull();
  mocks.show.online = false;
  mocks.show.projected = undefined;
  r.rerender(<EventPresentation eventId={event} regie />);
  expect(screen.getAllByRole('status')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Enable audio' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(document.querySelector('[data-action-id="event.show.fullscreen"]')!);
  await waitFor(() => expect(mocks.activate).toHaveBeenCalledOnce());
});
it('controls the shared show, captures snapshots, changes modes and handles rejected operations', async () => {
  const r = render(<EventPresentation eventId={event} regie />);
  await screen.findByTestId('presentation-canvas');
  const click = (id: string) =>
    fireEvent.click(document.querySelector(`[data-action-id="${id}"]`)!);
  click('event.show.follow');
  expect(mocks.command).toHaveBeenLastCalledWith({ action: 'control', followAgenda: true });
  click('event.show.reveal');
  expect(mocks.command).toHaveBeenLastCalledWith({ action: 'control', resultsVisible: true });
  click('event.show.running');
  expect(mocks.command).toHaveBeenLastCalledWith({ action: 'control', running: false });
  fireEvent.change(screen.getByRole('combobox', { name: 'View' }), { target: { value: 'agenda' } });
  expect(mocks.command).toHaveBeenLastCalledWith({ action: 'control', mode: 'agenda' });
  click('event.show.audio.paused');
  expect(mocks.command).toHaveBeenLastCalledWith(
    expect.objectContaining({ audio: expect.objectContaining({ status: 'paused', position: 11 }) })
  );
  click('event.show.audio.playing');
  click('event.show.audio.stopped');
  expect(mocks.command).toHaveBeenLastCalledWith(
    expect.objectContaining({ audio: expect.objectContaining({ status: 'stopped', position: 0 }) })
  );
  setVolume(0.8);
  expect(mocks.command).toHaveBeenLastCalledWith(
    expect.objectContaining({ audio: expect.objectContaining({ volume: 0.8 }) })
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Music' }), { target: { value: 'music' } });
  expect(mocks.command).toHaveBeenLastCalledWith({
    action: 'control',
    audio: { assetId: 'music', status: 'playing' },
    running: true,
  });
  click('event.show.previous');
  click('event.show.next');
  click('event.show.export');
  expect(mocks.export).toHaveBeenCalledWith(mocks.show.state.frame_id, 'pdf');
  click('event.show.release');
  expect(mocks.command).toHaveBeenLastCalledWith({ action: 'release' });
  mocks.show.hasControl = false;
  mocks.show.state.controller_device_id = 'other';
  r.rerender(<EventPresentation eventId={event} regie />);
  mocks.command.mockRejectedValueOnce(new Error('Lease changed'));
  click('event.show.claim');
  expect(mocks.command).toHaveBeenLastCalledWith({ action: 'claim', takeover: true });
  await waitFor(() => expect(mocks.command).toHaveBeenCalled());
  mocks.show.exportJob = { id: 'job', status: 'completed' };
  r.rerender(<EventPresentation eventId={event} regie />);
  expect(screen.getByRole('link', { name: /Download/ }).getAttribute('href')).toBe(
    '/api/studio/exports/job'
  );
});
it('offers test audio without uploads and restarts it with Play while retaining volume and stop controls', () => {
  mocks.show.assets = [];
  const r = render(<EventPresentation eventId={event} regie initialMode="agenda" />);
  const music = screen.getByRole('combobox', { name: 'Music' });
  expect(screen.getByRole('option', { name: 'Test sound (3 seconds)' })).toBeTruthy();
  fireEvent.change(music, { target: { value: 'builtin:test-tone' } });
  expect(mocks.command).toHaveBeenLastCalledWith({
    action: 'control',
    running: true,
    audio: { builtin: 'test-tone', status: 'playing', position: 0, loop: false, fadeSeconds: 0.05 },
  });
  mocks.show.state.audio = {
    builtin: 'test-tone',
    status: 'playing',
    position: 3,
    at: 1000,
    volume: 0.5,
  };
  r.rerender(<EventPresentation eventId={event} regie initialMode="agenda" />);
  expect((music as HTMLSelectElement).value).toBe('builtin:test-tone');
  fireEvent.click(screen.getByRole('button', { name: /^Play$/ }));
  expect(mocks.command).toHaveBeenLastCalledWith(
    expect.objectContaining({
      audio: expect.objectContaining({ builtin: 'test-tone', position: 0, status: 'playing' }),
    })
  );
  fireEvent.click(screen.getByRole('button', { name: /^Pause$/ }));
  expect(mocks.command).toHaveBeenLastCalledWith(
    expect.objectContaining({
      audio: expect.objectContaining({ builtin: 'test-tone', position: 3, status: 'paused' }),
    })
  );
  setVolume(0.3);
  expect(mocks.command).toHaveBeenLastCalledWith(
    expect.objectContaining({
      audio: expect.objectContaining({ builtin: 'test-tone', volume: 0.3 }),
    })
  );
  fireEvent.click(screen.getByRole('button', { name: /^Stop$/ }));
  expect(mocks.command).toHaveBeenLastCalledWith(
    expect.objectContaining({
      audio: expect.objectContaining({ builtin: 'test-tone', position: 0, status: 'stopped' }),
    })
  );
});
it('retains a disconnected audio selection and its warning when presentation buttons hide', () => {
  vi.useFakeTimers();
  mocks.show.devices[0].last_seen = -15000;
  const r = render(<EventPresentation eventId={event} regie initialMode="agenda" />);
  const output = r.container.querySelector(
    '[data-action-id="event.show.select4.change"]'
  ) as HTMLSelectElement;
  expect(output.value).toBe('screen');
  expect(output.selectedOptions[0].disabled).toBe(true);
  const warning = screen.getByRole('status');
  expect(warning.textContent).toBe('Audio output disconnected');
  fireEvent.click(screen.getByRole('button', { name: 'Show controls' }));
  act(() => vi.advanceTimersByTime(3000));
  expect(
    r.container.querySelector('.polity-presentation-buttons')?.getAttribute('data-visible')
  ).toBe('false');
  expect(warning.closest('.polity-presentation-buttons')).toBeNull();
  mocks.show.devices[0].last_seen = mocks.show.now;
  r.rerender(<EventPresentation eventId={event} regie initialMode="agenda" />);
  expect(screen.queryByText('Audio output disconnected')).toBeNull();
});
it('labels this device clearly and shows a pending check before an audio disconnection warning', () => {
  mocks.show.connectionChecking = true;
  mocks.show.devices[0].last_seen = -15000;
  const r = render(<EventPresentation eventId={event} regie initialMode="agenda" />);
  expect(screen.getByRole('status').textContent).toBe('Checking audio connection…');
  expect(screen.queryByText('Audio output disconnected')).toBeNull();
  expect(screen.getByRole('option', { name: /This device/ })).toBeTruthy();
  mocks.show.connectionChecking = false;
  r.rerender(<EventPresentation eventId={event} regie initialMode="agenda" />);
  expect(screen.getByRole('status').textContent).toBe('Audio output disconnected');
  mocks.show.devices[0].last_seen = mocks.show.now;
  r.rerender(<EventPresentation eventId={event} regie initialMode="agenda" />);
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByRole('option', { name: /^This device$/ }).textContent).toBe('This device');
  expect(mocks.activate).not.toHaveBeenCalled();
});

it('selects and activates this output in one gesture and supports Play here without extra clicks', async () => {
  mocks.show.state.audio_device_id = 'external';
  mocks.show.devices.push({ id: 'external', name: 'Stage', last_seen: mocks.show.now });
  const r = render(<EventPresentation eventId={event} regie />);
  let confirm!: () => void;
  mocks.command.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        confirm = resolve;
      })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Play here' }));
  expect(mocks.activate).toHaveBeenCalledOnce();
  expect(mocks.command).toHaveBeenLastCalledWith({ action: 'control', audioDeviceId: 'screen' });
  expect(mocks.activate.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.command.mock.invocationCallOrder[0]
  );
  expect(screen.getByRole('button', { name: 'Play here' }).hasAttribute('disabled')).toBe(true);
  expect(mocks.show.state.audio_device_id).toBe('external');
  await act(async () => confirm());
  mocks.activate.mockClear();
  mocks.command.mockRejectedValueOnce(new Error('Output unavailable'));
  fireEvent.change(r.container.querySelector('[data-action-id="event.show.select4.change"]')!, {
    target: { value: 'screen' },
  });
  expect(mocks.activate).toHaveBeenCalledOnce();
  await waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(2));
  expect(mocks.show.state.audio_device_id).toBe('external');
  mocks.show.canManage = false;
  mocks.show.hasControl = false;
  r.rerender(<EventPresentation eventId={event} regie />);
  expect(screen.queryByRole('button', { name: 'Play here' })).toBeNull();
});

it('primes audio before start and play commands and before requesting fullscreen', async () => {
  mocks.show.state.running = false;
  const r = render(<EventPresentation eventId={event} regie />);
  fireEvent.click(screen.getByRole('button', { name: 'Start show' }));
  expect(mocks.activate.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.command.mock.invocationCallOrder[0]
  );
  fireEvent.click(screen.getByRole('button', { name: /^Play$/ }));
  expect(mocks.activate.mock.invocationCallOrder[1]).toBeLessThan(
    mocks.command.mock.invocationCallOrder[1]
  );
  const request = vi.fn(
    () =>
      new Promise<void>(() => {
        /* Keep fullscreen pending to verify activation does not await it. */
      })
  );
  (r.container.firstElementChild as HTMLElement).requestFullscreen = request;
  fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
  expect(mocks.activate.mock.invocationCallOrder[2]).toBeLessThan(
    request.mock.invocationCallOrder[0]
  );
  expect(mocks.activate).toHaveBeenCalledTimes(3);
});

it('primes claims with stale output but preserves connected external output', () => {
  mocks.show.hasControl = false;
  mocks.show.state.audio_device_id = 'external';
  const r = render(<EventPresentation eventId={event} regie />);
  fireEvent.click(screen.getByRole('button', { name: 'Take controls' }));
  expect(mocks.activate).toHaveBeenCalledOnce();
  mocks.show.devices.push({ id: 'external', name: 'Stage', last_seen: mocks.show.now });
  r.rerender(<EventPresentation eventId={event} regie />);
  fireEvent.click(screen.getByRole('button', { name: 'Take controls' }));
  expect(mocks.activate).toHaveBeenCalledOnce();
});

it('shows audio readiness as status and offers a single retry for blocking or media errors', () => {
  mocks.show.canManage = false;
  mocks.show.hasControl = false;
  mocks.audioStatus = 'ready';
  const r = render(<EventPresentation eventId={event} />);
  expect(screen.getByRole('status').textContent).toBe('Audio ready');
  expect(screen.queryByRole('button', { name: 'Enable audio' })).toBeNull();
  mocks.audioStatus = 'activating';
  r.rerender(<EventPresentation eventId={event} />);
  expect(screen.getByRole('status').textContent).toBe('Starting audio…');
  mocks.audioStatus = 'blocked';
  mocks.audioError = 'The browser blocked audio.';
  r.rerender(<EventPresentation eventId={event} />);
  fireEvent.click(screen.getByRole('button', { name: 'Enable audio' }));
  expect(mocks.activate).toHaveBeenCalledOnce();
  mocks.audioStatus = 'error';
  mocks.audioError = 'Audio could not be played.';
  r.rerender(<EventPresentation eventId={event} />);
  fireEvent.click(screen.getByRole('button', { name: 'Retry audio' }));
  expect(mocks.activate).toHaveBeenCalledTimes(2);
});

it('disables local output switching while offline or checking the connection', () => {
  mocks.show.state.audio_device_id = 'external';
  mocks.show.online = false;
  const r = render(<EventPresentation eventId={event} regie />);
  const button = screen.getByRole('button', { name: 'Play here' });
  expect(button.hasAttribute('disabled')).toBe(true);
  fireEvent.click(button);
  expect(mocks.command).not.toHaveBeenCalled();
  expect(mocks.activate).not.toHaveBeenCalled();
  mocks.show.online = true;
  mocks.show.connectionChecking = true;
  r.rerender(<EventPresentation eventId={event} regie />);
  expect(button.hasAttribute('disabled')).toBe(true);
});
it('allows uploaded music to loop but keeps the built-in test sound one-shot', () => {
  const r = render(<EventPresentation eventId={event} regie initialMode="studio" />);
  const loop = screen.getByRole('checkbox', { name: 'Loop' });
  expect((loop as HTMLInputElement).disabled).toBe(false);
  loop.focus();
  expect(globalThis.document.activeElement).toBe(loop);
  fireEvent.keyDown(loop, { key: ' ' });
  fireEvent.click(loop);
  expect(mocks.command).toHaveBeenLastCalledWith(
    expect.objectContaining({ audio: { status: 'playing', loop: true } })
  );
  mocks.show.state.audio = { builtin: 'test-tone', status: 'playing', loop: true };
  r.rerender(<EventPresentation eventId={event} regie initialMode="studio" />);
  expect((loop as HTMLInputElement).disabled).toBe(true);
  expect(loop.getAttribute('aria-checked')).toBe('false');
  expect(r.container.querySelector('.polity-show-pulse')).toBeNull();
});

it('offers the complete cinematic sequence with Polity controls and permanent credits for every original', () => {
  vi.useFakeTimers();
  mocks.show.assets = [];
  const view = render(<EventPresentation eventId={event} regie />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Music' }), {
    target: { value: 'builtin:cinematic-sequence' },
  });
  expect(mocks.command).toHaveBeenLastCalledWith(
    expect.objectContaining({
      audio: {
        builtin: 'cinematic-sequence',
        status: 'playing',
        position: 0,
        loop: true,
        volume: 0.65,
        fadeSeconds: 1,
      },
      running: true,
    })
  );
  mocks.show.state.audio = {
    builtin: 'cinematic-sequence',
    status: 'playing',
    position: presentationSequence.cycleDuration * 1000,
    at: mocks.show.now,
    loop: true,
    volume: 0.65,
  };
  view.rerender(<EventPresentation eventId={event} regie />);
  expect(screen.getByRole('checkbox', { name: 'Loop' }).getAttribute('data-slot')).toBe('checkbox');
  expect(view.container.querySelector('input[type="range"]')).toBeNull();
  expect(screen.getByRole('slider', { name: /Volume 65 %/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(mocks.command).toHaveBeenLastCalledWith(
    expect.objectContaining({
      audio: expect.objectContaining({ position: mocks.show.state.audio.position }),
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Show controls' }));
  act(() => vi.advanceTimersByTime(3000));
  const credits = screen.getByLabelText('Music credits');
  expect(credits.closest('.polity-presentation-buttons')).toBeNull();
  for (const track of presentationMusic)
    expect(screen.getByRole('link', { name: track.title }).getAttribute('href')).toBe(track.source);
  expect(screen.getAllByRole('link', { name: 'CC BY 4.0' })).toHaveLength(3);
});

it.each(presentationMusic)(
  'offers $title without uploads, resumes paused music and keeps its credits visible',
  track => {
    vi.useFakeTimers();
    mocks.show.assets = [];
    const r = render(<EventPresentation eventId={event} regie initialMode="agenda" />);
    const selector = screen.getByRole('combobox', { name: 'Music' });
    expect(selector.querySelectorAll('optgroup')).toHaveLength(3);
    fireEvent.change(selector, { target: { value: `builtin:${track.id}` } });
    expect(mocks.command).toHaveBeenLastCalledWith({
      action: 'control',
      running: true,
      audio: {
        builtin: track.id,
        status: 'playing',
        position: 0,
        loop: true,
        volume: 0.65,
        fadeSeconds: 1,
      },
    });
    mocks.show.state.audio = {
      builtin: track.id,
      status: 'paused',
      position: 42,
      volume: 0.5,
      loop: true,
      at: 1000,
    };
    r.rerender(<EventPresentation eventId={event} regie initialMode="agenda" />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(mocks.command).toHaveBeenLastCalledWith(
      expect.objectContaining({
        audio: expect.objectContaining({ position: 42, status: 'playing' }),
      })
    );
    const loop = screen.getByRole('checkbox', { name: 'Loop' }) as HTMLInputElement;
    expect(loop.disabled).toBe(false);
    expect(loop.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(loop);
    expect(mocks.command).toHaveBeenLastCalledWith(
      expect.objectContaining({ audio: { status: 'paused', loop: false } })
    );
    mocks.show.state.audio.status = 'playing';
    mocks.show.state.audio.at = mocks.show.now - 172800000;
    r.rerender(<EventPresentation eventId={event} regie initialMode="agenda" />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(mocks.command).toHaveBeenLastCalledWith(
      expect.objectContaining({
        audio: expect.objectContaining({
          position: expect.closeTo((172800 + 42) % track.duration, 6),
        }),
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show controls' }));
    act(() => vi.advanceTimersByTime(3000));
    expect(
      r.container.querySelector('.polity-presentation-buttons')?.getAttribute('data-visible')
    ).toBe('false');
    const credits = screen.getByRole('contentinfo', { name: 'Music credits' });
    expect(credits.closest('.polity-presentation-buttons')).toBeNull();
    expect(credits.textContent).toContain('Kevin MacLeod');
    expect(screen.getByRole('link', { name: track.title }).getAttribute('href')).toBe(track.source);
    expect(screen.getByRole('link', { name: 'CC BY 4.0' }).getAttribute('href')).toBe(
      track.license.url
    );
  }
);

it('copies all three music credits without a control lease and reports clipboard failures', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const writeText = vi.fn(async (_text: string) => undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  mocks.show.hasControl = false;
  const r = render(<EventPresentation eventId={event} regie initialMode="agenda" />);
  try {
    const button = screen.getByRole('button', { name: 'Copy music credits' });
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByText('Credits copied for your video description.')).toBeTruthy()
    );
    expect(writeText).toHaveBeenLastCalledWith(presentationMusicCredits());
    writeText.mockRejectedValueOnce(new Error('Clipboard blocked'));
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText(/Could not copy credits/)).toBeTruthy());
    mocks.show.canManage = false;
    r.rerender(<EventPresentation eventId={event} regie initialMode="agenda" />);
    expect(screen.queryByRole('button', { name: 'Copy music credits' })).toBeNull();
  } finally {
    if (previous) Object.defineProperty(navigator, 'clipboard', previous);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

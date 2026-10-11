import { beforeEach, expect, it, vi } from 'vitest';
import { createEventTemplate } from '@/features/communication-studio/logic/event-templates';
import { checksum } from '@/server/checksum';
import { presentationCommandSchema } from '@/zero/communication-studio/presentation-schema';
import {
  presentationMusic,
  presentationSequence,
  presentationSequenceEnd,
} from '@/features/communication-studio/logic/presentation-audio';
const mock = vi.hoisted(() => ({
  query: vi.fn(async (_query: string, _args: unknown[]) => []),
  access: { read: true, manage: true },
  state: {} as any,
  document: {} as any,
  device: undefined as any,
  event: { status: 'active', current_agenda_item_id: null as string | null },
  outputConnected: true,
  assetAvailable: true,
  receipt: null as { actor_id: string; input_hash: string } | null,
}));
vi.mock('@/server/transaction', () => ({
  sqlTransaction: () => ({ query: mock.query }),
  lockAuthority: vi.fn(async () => undefined),
  rows: async (_: unknown, q: string) => {
    if (q.includes('as read')) return [mock.access];
    if (q.includes('from event_presentation where')) return mock.state ? [mock.state] : [];
    if (q.includes('from event_presentation_operation')) return mock.receipt ? [mock.receipt] : [];
    if (q.includes('select user_id,event_id')) return mock.device ? [mock.device] : [];
    if (q.includes('from studio_state')) return [{ document: mock.document }];
    if (q.includes('from event where')) return [mock.event];
    if (q.includes('last_seen>')) return mock.outputConnected ? [{ id: 'valid' }] : [];
    if (q.includes('from studio_asset')) return mock.assetAvailable ? [{ id: 'valid' }] : [];
    return [];
  },
}));
import { applyPresentationCommand } from '../presentation';
const [event, actor, device, asset] = Array.from({ length: 4 }, () => crypto.randomUUID());
const command = (
  action: 'heartbeat' | 'claim' | 'release' | 'control',
  extra: Record<string, unknown> = {}
) =>
  applyPresentationCommand({} as never, actor, {
    operationId: crypto.randomUUID(),
    eventId: event,
    deviceId: device,
    action,
    ...extra,
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.access = { read: true, manage: true };
  mock.outputConnected = true;
  mock.assetAvailable = true;
  mock.device = undefined;
  mock.receipt = null;
  mock.document = createEventTemplate('cover', event);
  mock.state = {
    project_id: event,
    mode: 'studio',
    frame_id: mock.document.nodes[0].id,
    follow_agenda: true,
    running: true,
    results_visible: false,
    revision: 1,
    controller_id: actor,
    controller_device_id: device,
    lease_until: Date.now() + 20000,
    audio_device_id: device,
    audio: { assetId: asset, status: 'playing', position: 15, at: Date.now() - 1000, volume: 0.8 },
  };
  mock.event = { status: 'active', current_agenda_item_id: null };
});

it('replays a completed operation without writes and rejects either changed actor or input', async () => {
  const input = presentationCommandSchema.parse({
    action: 'claim',
    operationId: crypto.randomUUID(),
    eventId: event,
    deviceId: device,
  });
  mock.receipt = { actor_id: actor, input_hash: checksum(input) };
  await applyPresentationCommand({} as never, actor, input);
  expect(mock.query).not.toHaveBeenCalled();
  mock.receipt.actor_id = crypto.randomUUID();
  await expect(applyPresentationCommand({} as never, actor, input)).rejects.toThrow(
    'Operation ID reused'
  );
  mock.receipt.actor_id = actor;
  mock.receipt.input_hash = 'changed';
  await expect(applyPresentationCommand({} as never, actor, input)).rejects.toThrow(
    'Operation ID reused'
  );
  expect(mock.query).not.toHaveBeenCalled();
});
it('refuses a device from another event and stops inherited audio when the presentation is stopped', async () => {
  mock.device = { user_id: actor, event_id: crypto.randomUUID() };
  await expect(command('heartbeat')).rejects.toThrow('permission_denied');
  mock.device = undefined;
  await command('control', { running: false });
  expect((mock.query.mock.calls.at(-2)![1][7] as any).status).toBe('stopped');
});

it('rejects a stale control revision and an unavailable uploaded audio asset before updating presentation', async () => {
  await expect(command('control', { expectedRevision: 0 })).rejects.toThrow('zwischenzeitlich');
  expect(mock.query).not.toHaveBeenCalled();
  mock.assetAvailable = false;
  await expect(
    command('control', { audio: { assetId: asset, status: 'playing' } })
  ).rejects.toThrow('Audiodatei ist nicht verfügbar');
  expect(mock.query).not.toHaveBeenCalled();
  mock.assetAvailable = true;
  delete mock.state.audio.at;
  await command('control', { audio: { status: 'paused' } });
  expect((mock.query.mock.calls.at(-2)![1][7] as any).position).toBe(15);
});

it('preserves sequence time for days and its non-looping finish through pause and volume commands', async () => {
  const capture = () => mock.query.mock.calls.at(-2)![1][7] as any;
  mock.assetAvailable = false;
  await command('control', {
    audio: { builtin: 'cinematic-sequence', status: 'playing', loop: true, volume: 0.65 },
  });
  expect(capture()).toMatchObject({ builtin: 'cinematic-sequence', position: 0, loop: true });
  expect(capture().assetId).toBeUndefined();
  mock.state.audio = {
    ...capture(),
    position: presentationSequence.cycleDuration * 1000 + 1.5,
    at: Date.now(),
  };
  await command('control', { audio: { status: 'playing', loop: false } });
  const audio = capture();
  expect(audio.position).toBeGreaterThan(86400);
  expect(audio.sequenceEndPosition).toBe(presentationSequenceEnd(audio.position));
  mock.state.audio = audio;
  await command('control', { audio: { status: 'paused' } });
  expect(capture().sequenceEndPosition).toBe(audio.sequenceEndPosition);
  mock.state.audio = capture();
  await command('control', { audio: { status: 'paused', volume: 0.3 } });
  expect(capture().sequenceEndPosition).toBe(audio.sequenceEndPosition);
  await command('control', { audio: { status: 'playing', loop: true } });
  expect(capture().sequenceEndPosition).toBeUndefined();
  await command('control', { audio: { status: 'stopped' } });
  expect(capture().position).toBe(0);
  expect(capture().sequenceEndPosition).toBeUndefined();
  await command('control', { audio: { status: 'playing', builtin: 'cinematic-hope' } });
  expect(capture().sequenceEndPosition).toBeUndefined();
});
it('allows anonymous display heartbeats while refusing anonymous controller claims', async () => {
  await applyPresentationCommand({} as never, 'anon', {
    eventId: event,
    deviceId: device,
    action: 'heartbeat',
    name: 'Display',
    operationId: crypto.randomUUID(),
  });
  expect(mock.query).toHaveBeenCalledWith(
    expect.stringContaining('insert into event_presentation_device'),
    [device, event, null, 'Display', expect.any(Number)]
  );
  await expect(
    applyPresentationCommand({} as never, 'anon', {
      eventId: event,
      deviceId: device,
      action: 'claim',
      operationId: crypto.randomUUID(),
    })
  ).rejects.toThrow('permission_denied');
});
it('rejects a presentation removed after authorization', async () => {
  mock.state = null;
  await expect(command('claim')).rejects.toThrow('Presentation unavailable');
  expect(mock.query).not.toHaveBeenCalled();
});
it('releases a current controller and stops its playback', async () => {
  await command('release');
  expect(mock.query).toHaveBeenCalledWith(expect.stringContaining('controller_id=null'), [
    event,
    expect.any(Number),
  ]);
});
it('follows an agenda with no matching visible frame and keeps audio position without an origin timestamp', async () => {
  mock.document.nodes = [];
  mock.state.audio = { status: 'playing', position: 4 };
  await command('control', { followAgenda: true, audio: { status: 'playing', volume: 0.4 } });
  expect(mock.query.mock.calls.at(-2)![1][2]).toBeNull();
  expect(mock.query.mock.calls.at(-2)![1][7]).toMatchObject({ position: 4, volume: 0.4 });
});
it('allows visual commands with a disconnected inherited output but rejects explicitly selecting it', async () => {
  mock.outputConnected = false;
  const frame = createEventTemplate('speech', event).nodes[0];
  mock.document.nodes.push(frame);
  for (const input of [
    { frameId: frame.id },
    { frameId: mock.state.frame_id },
    { mode: 'agenda' },
    { resultsVisible: true },
  ]) {
    await command('control', input);
    const update = mock.query.mock.calls.at(-2)!;
    expect(update[1][6]).toBe(device);
    // The SQL presentation trigger owns slide cues and fades.
    expect(update[1][7]).toEqual(mock.state.audio);
  }
  await expect(command('control', { audioDeviceId: device })).rejects.toThrow('Audiogerät');
  await command('control', { audioDeviceId: null });
  expect(mock.query.mock.calls.at(-2)![1][6]).toBeNull();
  mock.outputConnected = true;
  await command('control', { audioDeviceId: device });
  expect(mock.query.mock.calls.at(-2)![1][6]).toBe(device);
});
it('switches between built-in test audio and protected assets without retaining the previous source', async () => {
  await command('control', {
    audio: { builtin: 'test-tone', status: 'playing', position: 0, loop: true },
  });
  const first = mock.query.mock.calls.at(-2)![1][7] as any;
  expect(first).toMatchObject({
    builtin: 'test-tone',
    status: 'playing',
    position: 0,
    loop: false,
  });
  expect(first.assetId).toBeUndefined();
  mock.state.audio = first;
  await command('control', { audio: { status: 'paused' } });
  expect(mock.query.mock.calls.at(-2)![1][7]).toMatchObject({
    builtin: 'test-tone',
    status: 'paused',
  });
  await command('control', { audio: { assetId: asset, status: 'playing' } });
  const second = mock.query.mock.calls.at(-2)![1][7] as any;
  expect(second).toMatchObject({ assetId: asset, status: 'playing', position: 0 });
  expect(second.builtin).toBeUndefined();
  mock.assetAvailable = false;
  await expect(
    command('control', { audio: { assetId: asset, status: 'playing' } })
  ).rejects.toThrow('Audiodatei');
});
it('allows readable audience heartbeats but rejects unauthorized management and foreign devices', async () => {
  await command('heartbeat');
  expect(mock.query).toHaveBeenCalledWith(
    expect.stringContaining('insert into event_presentation_device'),
    expect.any(Array)
  );
  mock.access.manage = false;
  await expect(command('claim')).rejects.toThrow();
  mock.device = { user_id: crypto.randomUUID(), event_id: event };
  await expect(command('heartbeat')).rejects.toThrow();
  mock.device = undefined;
  mock.access.read = false;
  await expect(command('heartbeat')).rejects.toThrow();
});
it('enforces exclusive control and revision checks and retains music settings across pause commands', async () => {
  await command('control', { audio: { status: 'paused' } });
  const update = mock.query.mock.calls.find(([q]) => String(q).includes('audio=$8'));
  expect(update?.[1]?.[7]).toMatchObject({
    status: 'paused',
    volume: 0.8,
    position: expect.any(Number),
  });
  await expect(command('control', { expectedRevision: 0 })).rejects.toThrow('zwischenzeitlich');
  mock.state.controller_device_id = crypto.randomUUID();
  await expect(command('claim')).rejects.toThrow('bereits aktiv');
  await command('claim', { takeover: true });
  mock.state.controller_device_id = device;
  mock.state.lease_until = Date.now() - 1;
  await expect(command('control')).rejects.toThrow('übernommen');
});
it('registers the claiming device and defaults only an unassigned audio output', async () => {
  mock.state.audio_device_id = null;
  await command('claim');
  expect(mock.query).toHaveBeenCalledWith(
    expect.stringContaining('insert into event_presentation_device'),
    [device, event, actor, 'Screen', expect.any(Number)]
  );
  expect(mock.query).toHaveBeenCalledWith(expect.stringContaining('audio_device_id=$6'), [
    event,
    actor,
    device,
    expect.any(Number),
    expect.any(Number),
    device,
  ]);
  mock.device = { user_id: crypto.randomUUID(), event_id: event };
  await expect(command('claim', { takeover: true })).rejects.toThrow('permission_denied');
});
it('replaces a disconnected output on claim and retains a connected external output', async () => {
  const external = crypto.randomUUID();
  mock.state.audio_device_id = external;
  await command('claim');
  expect(mock.query).toHaveBeenCalledWith(expect.stringContaining('audio_device_id=$6'), [
    event,
    actor,
    device,
    expect.any(Number),
    expect.any(Number),
    external,
  ]);
  mock.query.mockClear();
  mock.outputConnected = false;
  await command('claim');
  expect(mock.query).toHaveBeenCalledWith(expect.stringContaining('audio_device_id=$6'), [
    event,
    actor,
    device,
    expect.any(Number),
    expect.any(Number),
    device,
  ]);
});
it('delegates reveal cues to SQL and prevents cancelled events and removed frames from being presented', async () => {
  mock.document.show.cues = [
    {
      id: crypto.randomUUID(),
      frameId: mock.state.frame_id,
      assetId: asset,
      trigger: 'reveal',
      action: 'play',
      volume: 0.5,
      loop: false,
      fadeSeconds: 1,
    },
  ];
  await command('control', { resultsVisible: true });
  expect(mock.query.mock.calls.find(([q]) => String(q).includes('audio=$8'))?.[1]?.[7]).toEqual(
    mock.state.audio
  );
  await expect(command('control', { frameId: crypto.randomUUID() })).rejects.toThrow('Frame');
  mock.event.status = 'cancelled';
  await expect(command('control', { running: true })).rejects.toThrow('abgesagt');
});
it('delegates intro exit and incoming cues to SQL while preserving explicit audio commands', async () => {
  const frame = createEventTemplate('speech', event).nodes[0];
  mock.document.nodes.push(frame);
  await command('control', { frameId: frame.id });
  expect(mock.query.mock.calls.at(-2)![1][7]).toEqual(mock.state.audio);
  mock.document.show.cues = [
    {
      id: crypto.randomUUID(),
      frameId: frame.id,
      assetId: asset,
      trigger: 'enter',
      action: 'play',
      volume: 0.3,
      loop: true,
      fadeSeconds: 2,
    },
  ];
  await command('control', { frameId: frame.id });
  expect(mock.query.mock.calls.at(-2)![1][7]).toEqual(mock.state.audio);
  await command('control', { frameId: frame.id, audio: { status: 'playing', volume: 0.7 } });
  expect(mock.query.mock.calls.at(-2)![1][7]).toMatchObject({ status: 'playing', volume: 0.7 });
});

it.each(presentationMusic)(
  'allows $title without an upload, preserves looping and resumes a bounded phase after days',
  async track => {
    vi.useFakeTimers();
    try {
      mock.assetAvailable = false;
      await command('control', { audio: { builtin: track.id, status: 'playing', loop: true } });
      const audio = mock.query.mock.calls.at(-2)![1][7] as any;
      expect(audio).toMatchObject({
        builtin: track.id,
        status: 'playing',
        loop: true,
        position: 0,
      });
      expect(audio.assetId).toBeUndefined();
      mock.state.audio = { ...audio, position: 12, at: Date.now() - 172800000 };
      await command('control', { audio: { status: 'paused' } });
      const paused = mock.query.mock.calls.at(-2)![1][7] as any;
      expect(paused.position).toBeCloseTo((172800 + 12) % track.duration);
      expect(paused.loop).toBe(true);
      mock.state.audio = paused;
      await command('control', { audio: { status: 'playing' } });
      expect((mock.query.mock.calls.at(-2)![1][7] as any).position).toBe(paused.position);
      await command('control', { audio: { status: 'stopped' } });
      expect((mock.query.mock.calls.at(-2)![1][7] as any).position).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  }
);

it('delegates integrated enter cues to SQL without checking uploads or changing output selection', async () => {
  mock.state.running = false;
  mock.state.audio = {};
  mock.assetAvailable = false;
  mock.document.show.cues = [
    {
      id: crypto.randomUUID(),
      frameId: mock.state.frame_id,
      builtin: 'cinematic-atmosphere',
      trigger: 'enter',
      action: 'play',
      loop: true,
      volume: 0.65,
      fadeSeconds: 1,
    },
  ];
  await command('control', { running: true });
  const audio = mock.query.mock.calls.at(-2)![1][7] as any;
  expect(audio).toEqual({});
  expect(audio.assetId).toBeUndefined();
  mock.state.audio = audio;
  mock.state.running = true;
  mock.outputConnected = false;
  const next = createEventTemplate('speech', event).nodes[0];
  mock.document.nodes.push(next);
  await command('control', { frameId: next.id });
  expect(mock.query.mock.calls.at(-2)![1][7]).toEqual(mock.state.audio);
  expect(mock.query.mock.calls.at(-2)![1][6]).toBe(device);
});

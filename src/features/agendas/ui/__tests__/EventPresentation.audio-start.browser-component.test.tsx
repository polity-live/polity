import { act, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createEventTemplate } from '@/features/communication-studio/logic/event-templates';
import { presentationMusic } from '@/features/communication-studio/logic/presentation-audio';
import type { ShowState } from '@/features/communication-studio/logic/live-contract';
import { usePresentationAudio } from '../../hooks/usePresentationAudio';
import { EventPresentation } from '../EventPresentation';

const fixture = vi.hoisted(() => ({ show: {} as any, command: vi.fn(), reject: false }));
vi.mock('@/zero/communication-studio/useEventPresentation', () => ({
  useEventPresentation: () => fixture.show,
}));
vi.mock('../../hooks/useAnimatedStudioDocument', () => ({
  useAnimatedStudioDocument: (document: unknown) => document,
}));
vi.mock('@/features/communication-studio/ui/KonvaStudioCanvas', () => ({
  default: () => <div />,
}));

const players: HTMLAudioElement[] = [];
const NativeAudio = window.Audio;
const eventId = '11111111-1111-4111-8111-111111111111';
beforeEach(() => {
  fixture.reject = false;
  players.length = 0;
  vi.stubGlobal('Audio', function () {
    const player = new NativeAudio();
    players.push(player);
    return player;
  });
});
afterEach(() => {
  players.forEach(player => {
    player.pause();
    player.src = '';
  });
  vi.unstubAllGlobals();
});

function Audience({ state, online }: { state: ShowState; online: boolean }) {
  const audio = usePresentationAudio(state, 'other', online);
  return <output aria-label="Other output">{audio.status}</output>;
}

function Harness() {
  const document = createEventTemplate('cover', eventId);
  const [online, setOnline] = useState(true);
  const [state, setState] = useState({
    audio_device_id: 'screen',
    running: true,
    mode: 'studio',
    frame_id: document.nodes[0].id,
    lease_until: Date.now() + 120000,
    audio: {
      builtin: presentationMusic[0].id,
      status: 'playing',
      position: 12,
      at: Date.now(),
      volume: 0.2,
      loop: true,
      fadeSeconds: 0,
    },
  } as ShowState);
  fixture.command.mockImplementation(async (input: { audioDeviceId?: string }) => {
    if (fixture.reject) throw new Error('Output unavailable');
    if (input.audioDeviceId)
      setState(current => ({ ...current, audio_device_id: input.audioDeviceId! }));
  });
  fixture.show = {
    state,
    document,
    projected: document,
    project: { id: 'project' },
    deviceId: 'screen',
    now: Date.now(),
    clockOffset: 0,
    online,
    connectionChecking: false,
    canManage: true,
    hasControl: true,
    devices: ['screen', 'other'].map(id => ({
      id,
      name: id === 'other' ? 'Stage' : 'Screen',
      last_seen: Date.now(),
    })),
    sources: [],
    eventSources: [],
    assets: [],
    command: fixture.command,
  };
  return (
    <>
      <EventPresentation eventId={eventId} regie />
      <Audience state={state} online={online} />
      <button onClick={() => setOnline(value => !value)}>Toggle connection</button>
    </>
  );
}

it('starts native audio automatically or with one blocked-browser click and switches exclusive outputs', async () => {
  const view = render(<Harness />);
  if (import.meta.env.VITE_TEST_AUDIO_AUTOPLAY_POLICY === 'block') {
    await waitFor(() => expect(screen.getByText(/The browser blocked audio/)).toBeVisible());
    expect(players.every(player => player.paused)).toBe(true);
    expect(players).toHaveLength(6);
    await page.getByRole('button', { name: 'Enable audio' }).click();
  } else if (import.meta.env.VITE_TEST_AUDIO_AUTOPLAY_POLICY !== 'allow') {
    await waitFor(() =>
      expect(
        screen.queryByText('Audio ready') || screen.queryByText(/The browser blocked audio/)
      ).not.toBeNull()
    );
    if (screen.queryByText(/The browser blocked audio/)) {
      await page.getByRole('button', { name: 'Enable audio' }).click();
    }
  }
  await waitFor(
    () =>
      expect(players.find(player => player.src.endsWith(presentationMusic[0].url))?.paused).toBe(
        false
      ),
    { timeout: 15000 }
  );
  expect(screen.getByText('Audio ready')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Enable audio' })).toBeNull();
  const local = players.find(player => player.src.endsWith(presentationMusic[0].url))!;
  expect(local.currentTime).toBeGreaterThanOrEqual(12);
  expect(local.volume).toBe(0.2);
  expect(local.error).toBeNull();
  const before = local.currentTime;
  await page.getByRole('button', { name: 'Toggle connection' }).click();
  expect(local.paused).toBe(true);
  await page.getByRole('button', { name: 'Toggle connection' }).click();
  await waitFor(() => expect(local.paused).toBe(false));
  expect(local.currentTime).toBeGreaterThanOrEqual(before - 0.3);

  // A real select changes shared output; the second view starts without an activation button.
  await page.getByRole('combobox', { name: 'Audio output' }).selectOptions('other');
  await waitFor(() => expect(screen.getByLabelText('Other output').textContent).toBe('ready'));
  expect(local.paused).toBe(true);
  await waitFor(() =>
    expect(
      players.filter(player => !player.paused && player.src.endsWith(presentationMusic[0].url))
    ).toHaveLength(1)
  );
  const remote = players.find(
    player => !player.paused && player.src.endsWith(presentationMusic[0].url)
  )!;
  fixture.reject = true;
  screen.getByRole('button', { name: 'Play here' }).focus();
  expect(screen.getByRole('button', { name: 'Play here' })).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(local.paused).toBe(true);
  expect(remote.paused).toBe(false);
  fixture.reject = false;
  await page.getByRole('button', { name: 'Play here' }).click();
  await waitFor(() => expect(local.paused).toBe(false));
  expect(remote.paused).toBe(true);
  expect(screen.queryByRole('button', { name: 'Enable audio' })).toBeNull();
  await page.getByRole('combobox', { name: 'Audio output' }).selectOptions('other');
  await waitFor(() => expect(local.paused).toBe(true));
  await page.getByRole('combobox', { name: 'Audio output' }).selectOptions('screen');
  await waitFor(() => expect(local.paused).toBe(false));
  expect(remote.paused).toBe(true);
  expect(screen.queryByRole('button', { name: 'Enable audio' })).toBeNull();
  view.unmount();
  expect(players.every(player => player.paused && !player.getAttribute('src'))).toBe(true);

  // Remounting a selected output models reopening with a fresh local player.
  const reopened = render(<Harness />);
  await waitFor(
    () =>
      expect(
        players.some(player => !player.paused && player.src.endsWith(presentationMusic[0].url))
      ).toBe(true),
    { timeout: 15000 }
  );
  act(() => reopened.unmount());
}, 30000);

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { usePresentationAudio } from '../usePresentationAudio';
import {
  presentationMusic,
  presentationSequence,
  presentationSequenceVoices,
} from '@/features/communication-studio/logic/presentation-audio';
import type { ShowState } from '@/features/communication-studio/logic/live-contract';

const players: HTMLAudioElement[] = [];
const NativeAudio = window.Audio;
beforeEach(() => {
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

function Output({ state, id, online }: { state: ShowState; id: string; online: boolean }) {
  const audio = usePresentationAudio(state, id, online);
  return (
    <div>
      <button onClick={() => void audio.activate()}>Activate {id}</button>
      <output aria-label={`Audio error ${id}`}>{audio.error}</output>
      <output aria-label={`Audio status ${id}`}>{audio.status}</output>
    </div>
  );
}

async function startSelectedOutput() {
  // Let the automatic attempt settle before issuing a fallback gesture. A gesture
  // during the attempt deliberately replaces its players, invalidating slot indexes.
  await waitFor(() =>
    expect(screen.getByLabelText('Audio status selected').textContent).not.toBe('activating')
  );
  if (screen.getByLabelText('Audio status selected').textContent !== 'ready') {
    await page.getByRole('button', { name: 'Activate selected' }).click();
  }
  await waitFor(() =>
    expect(screen.getByLabelText('Audio status selected').textContent).toBe('ready')
  );
  return players.filter(player => player.getAttribute('src')).slice(0, 6);
}

it('plays a bounded transition over native music and never replays it after its shared deadline', async () => {
  const state = {
    audio_device_id: 'selected',
    running: true,
    lease_until: Date.now() + 60000,
    audio: {
      builtin: 'cinematic-atmosphere',
      status: 'playing',
      loop: true,
      volume: 0.2,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      position: 5,
      at: Date.now(),
      cueId: 'music',
      transition: {
        builtin: 'test-tone',
        status: 'playing',
        position: 0,
        at: Date.now(),
        volume: 0.3,
        durationSeconds: 3,
        fadeInSeconds: 0,
        fadeOutSeconds: 0.2,
        cueId: 'transition',
      },
    },
  } as ShowState;
  const view = render(<Output state={state} id="selected" online />);
  const output = await startSelectedOutput();
  await waitFor(
    () => {
      expect(output[1].src).toContain('/audio/cinematic/');
      expect(output[4].src).toContain('test-tone');
      expect(output[1].paused).toBe(false);
      expect(output[4].paused).toBe(false);
    },
    { timeout: 10000 }
  );
  expect(output[4].loop).toBe(false);
  expect(output[4].volume).toBeGreaterThan(0);
  view.rerender(<Output state={state} id="selected" online={false} />);
  expect(players.every(player => player.paused)).toBe(true);
  const reconnected = {
    ...state,
    audio: { ...state.audio, transition: { ...state.audio.transition!, at: Date.now() - 1000 } },
  };
  view.rerender(<Output state={reconnected} id="selected" online />);
  await waitFor(() => expect(output[4].paused).toBe(false));
  expect(output[4].currentTime).toBeGreaterThanOrEqual(0.7);
  await waitFor(() => expect(output[4].paused).toBe(true), { timeout: 6000 });
  expect(output[1].paused).toBe(false);
  const expired = {
    ...state,
    audio: { ...state.audio, transition: { ...state.audio.transition!, at: Date.now() - 10000 } },
  };
  view.rerender(<Output state={expired} id="selected" online={false} />);
  view.rerender(<Output state={expired} id="selected" online />);
  expect(output[4].paused).toBe(true);
  expect(players.filter(player => player.getAttribute('src'))).toHaveLength(6);
  view.unmount();
  expect(players.every(player => player.paused && !player.getAttribute('src'))).toBe(true);
}, 15000);

it.each(presentationMusic)(
  'decodes the original $title, repeats across its ending and resumes only the selected output',
  async track => {
    const state = {
      audio_device_id: 'selected',
      running: true,
      lease_until: Date.now() + 60000,
      audio: {
        builtin: track.id,
        status: 'playing',
        loop: true,
        volume: 0.2,
        fadeSeconds: 0,
        position: track.duration - 0.3,
        at: Date.now(),
      },
    } as ShowState;
    const props = (online: boolean, current = state) => (
      <>
        <Output state={current} id="selected" online={online} />
        <Output state={current} id="other" online />
      </>
    );
    const view = render(props(true));
    const output = await startSelectedOutput();
    await page.getByRole('button', { name: 'Activate other' }).click();
    const player = output[1];
    await waitFor(
      () => {
        expect(player.src.endsWith(track.url)).toBe(true);
        expect(player.readyState).toBeGreaterThanOrEqual(2);
        expect(player.paused).toBe(false);
      },
      { timeout: 15000 }
    );
    console.info(`${track.id}: decoded duration ${player.duration}s`);
    expect(player.duration).toBeCloseTo(track.duration, 1);
    expect(player.error).toBeNull();
    expect(player.volume).toBe(0.2);
    expect(player.loop).toBe(true);
    await waitFor(
      () => {
        expect(player.paused).toBe(false);
        expect(player.currentTime).toBeLessThan(10);
      },
      { timeout: 15000 }
    );
    await waitFor(() =>
      expect(
        players
          .filter(p => !output.slice(0, 2).includes(p))
          .every(other => other.paused && !other.src.endsWith(track.url))
      ).toBe(true)
    );
    act(() => view.rerender(props(false)));
    expect(player.paused).toBe(true);
    const longRunning = {
      ...state,
      audio: { ...state.audio, position: 12, at: Date.now() - 172800000 },
    };
    act(() => view.rerender(props(true, longRunning)));
    await waitFor(() => expect(player.paused).toBe(false));
    const target = (12 + (Date.now() - longRunning.audio.at) / 1000) % player.duration;
    expect(Math.abs(player.currentTime - target)).toBeLessThan(1);
    view.unmount();
    expect(players.every(audio => audio.paused && !audio.getAttribute('src'))).toBe(true);
  },
  30000
);

it('crossfades actual MP3s in the selected sequence output and restores the cyclic overlap after two days', async () => {
  const state = {
    audio_device_id: 'selected',
    running: true,
    lease_until: Date.now() + 60000,
    audio: {
      builtin: 'cinematic-sequence',
      status: 'playing',
      loop: true,
      volume: 0.2,
      fadeSeconds: 0,
      position: presentationSequence.tracks[0].duration - 3.3,
      at: Date.now(),
    },
  } as ShowState;
  const props = (online: boolean, current = state) => (
    <>
      <Output state={current} id="selected" online={online} />
      <Output state={current} id="other" online />
    </>
  );
  const view = render(props(true));
  const output = await startSelectedOutput();
  await page.getByRole('button', { name: 'Activate other' }).click();
  await waitFor(() => expect(output.slice(0, 2).filter(p => !p.paused)).toHaveLength(2), {
    timeout: 15000,
  });
  for (const player of output.slice(0, 2)) {
    expect(player.error).toBeNull();
    expect(player.loop).toBe(false);
  }
  expect(output.slice(0, 2).reduce((sum, p) => sum + p.volume, 0)).toBeCloseTo(0.2, 2);
  await waitFor(() =>
    expect(players.filter(p => !output.slice(0, 2).includes(p)).every(p => p.paused)).toBe(true)
  );
  expect(
    players
      .filter(p => !output.slice(0, 2).includes(p))
      .every(p => !p.src.includes('/audio/cinematic/'))
  ).toBe(true);
  await waitFor(
    () => {
      const active = output.slice(0, 2).filter(p => !p.paused);
      expect(active).toHaveLength(1);
      expect(active[0].src.endsWith(presentationSequence.tracks[1].url)).toBe(true);
    },
    { timeout: 15000 }
  );
  act(() => view.rerender(props(false)));
  expect(players.every(p => p.paused)).toBe(true);
  // Advance the shared phase, rather than spending two days in a real-time test.
  const restored = {
    ...state,
    audio: {
      ...state.audio,
      position: presentationSequence.cycleDuration * 1000 + 1.5,
      at: Date.now(),
    },
  };
  act(() => view.rerender(props(true, restored)));
  await waitFor(() => expect(output.slice(0, 2).every(p => !p.paused)).toBe(true), {
    timeout: 15000,
  });
  const mix = presentationSequenceVoices(
    restored.audio.position! + (Date.now() - restored.audio.at!) / 1000,
    true
  );
  for (const voice of mix) {
    const player = players.find(p => p.src.endsWith(voice.track.url))!;
    expect(Math.abs(player.currentTime - voice.position)).toBeLessThan(0.5);
    expect(player.volume).toBeCloseTo(voice.gain * 0.2, 1);
  }
  view.unmount();
  expect(players.every(p => p.paused && !p.getAttribute('src'))).toBe(true);
}, 30000);

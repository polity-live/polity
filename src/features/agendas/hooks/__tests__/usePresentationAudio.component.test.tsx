// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { presentationTestTone } from '@/features/communication-studio/logic/live-contract';
import {
  presentationMusic,
  presentationSequence,
  presentationSequenceVoices,
  presentationSequenceEnd,
} from '@/features/communication-studio/logic/presentation-audio';
import { usePresentationAudio } from '../usePresentationAudio';
import type { ShowState } from '@/features/communication-studio/logic/live-contract';
const players: FakeAudio[] = [];
class FakeAudio {
  src = '';
  volume = 1;
  currentTime = 0;
  duration = 120;
  loop = false;
  readyState = 1;
  paused = true;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  constructor() {
    players.push(this);
  }
}
beforeEach(() => {
  players.length = 0;
  vi.stubGlobal('Audio', FakeAudio);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const state = () =>
  ({
    audio_device_id: 'screen',
    running: true,
    lease_until: Date.now() + 20000,
    audio: {
      assetId: 'intro',
      status: 'playing',
      position: 15,
      at: Date.now(),
      volume: 0.7,
      loop: true,
      fadeSeconds: 0,
    },
  }) as ShowState;
it('activates only the selected output, seeks to shared time and silences disconnected screens', async () => {
  const s = state();
  const h = renderHook(({ online }) => usePresentationAudio(s, 'screen', online), {
    initialProps: { online: true },
  });
  expect(players).toHaveLength(6);
  await act(() => Promise.resolve()); // flush automatic activation
  await waitFor(() => expect(players[1].src).toBe('/api/studio/media/intro'));
  expect(players[1].currentTime).toBeGreaterThanOrEqual(15);
  expect(players[1].volume).toBe(0.7);
  expect(players[1].loop).toBe(true);
  const calls = players[1].pause.mock.calls.length;
  h.rerender({ online: false });
  expect(players[1].pause.mock.calls.length).toBeGreaterThan(calls);
  h.unmount();
  expect(players.every(p => p.src === '')).toBe(true);
});
it('resumes the selected output at shared time after reconnecting instead of restarting the track', async () => {
  vi.useFakeTimers();
  const s = state();
  const h = renderHook(({ online }) => usePresentationAudio(s, 'screen', online), {
    initialProps: { online: true },
  });
  await act(() => Promise.resolve()); // flush automatic activation
  h.rerender({ online: false });
  act(() => vi.advanceTimersByTime(4000));
  await act(async () => h.rerender({ online: true }));
  expect(players[1].currentTime).toBe(19);
  expect(players[1].play).toHaveBeenCalledTimes(3); // unlock, initial playback, reconnect
  h.unmount();
});
it('ignores a cancelled play promise from before a disconnect and resumes the same cue', async () => {
  vi.useFakeTimers();
  const s = state();
  const h = renderHook(({ online }) => usePresentationAudio(s, 'screen', online), {
    initialProps: { online: true },
  });
  await act(() => Promise.resolve()); // flush automatic activation
  let reject!: (error: Error) => void;
  players[1].play.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      })
  );
  act(() => {
    players[1].paused = true;
    vi.advanceTimersByTime(100);
  });
  h.rerender({ online: false });
  await act(async () => {
    reject(new Error('Playback was interrupted by pause'));
  });
  expect(h.result.current.error).toBe('');
  await act(async () => h.rerender({ online: true }));
  expect(players[1].paused).toBe(false);
  expect(h.result.current.error).toBe('');
  h.unmount();
});
it('plays the built-in test tone once on its selected output and replays only on a fresh command', async () => {
  vi.useFakeTimers();
  const s = state();
  s.audio = {
    builtin: 'test-tone',
    status: 'playing',
    at: Date.now(),
    volume: 0.4,
    loop: true,
    fadeSeconds: 0,
  };
  const h = renderHook(({ state }) => usePresentationAudio(state, 'screen', true), {
    initialProps: { state: s },
  });
  await act(() => Promise.resolve()); // flush automatic activation
  expect(players[1].src).toBe(presentationTestTone.url);
  expect(players[1].loop).toBe(false);
  expect(players[1].volume).toBe(0.4);
  act(() => vi.advanceTimersByTime(4000));
  const count = players[1].play.mock.calls.length;
  h.rerender({ state: { ...s, lease_until: Date.now() + 20000 } });
  expect(players[1].play).toHaveBeenCalledTimes(count);
  await act(async () =>
    h.rerender({ state: { ...s, audio: { ...s.audio, at: Date.now(), position: 0 } } })
  );
  expect(players[1].currentTime).toBe(0);
  expect(players[1].play).toHaveBeenCalledTimes(count + 1);
  h.rerender({ state: { ...s, audio: { ...s.audio, status: 'stopped' } } });
  expect(players[1].currentTime).toBe(0);
  h.unmount();
  const other = renderHook(() => usePresentationAudio(s, 'other', true));
  await act(async () => other.result.current.activate());
  expect(players.slice(-2).every(p => p.src !== presentationTestTone.url)).toBe(true);
  other.unmount();
});
it('keeps other audience devices silent and stops music when the controller lease has expired', async () => {
  const s = state();
  const h = renderHook(() => usePresentationAudio(s, 'other', true));
  await act(() => Promise.resolve()); // flush automatic activation
  expect(players.every(p => !p.src.startsWith('/api/'))).toBe(true);
  h.unmount();
  s.lease_until = Date.now() - 1;
  const expired = renderHook(() => usePresentationAudio(s, 'screen', true));
  await act(async () => expired.result.current.activate());
  expect(players.at(-1)!.src).not.toContain('/api/');
  expired.unmount();
});
it('allows a fresh user gesture after browser audio activation is rejected', async () => {
  const original = FakeAudio.prototype.constructor;
  let reject = true;
  vi.stubGlobal(
    'Audio',
    class extends FakeAudio {
      constructor() {
        super();
        this.play = vi.fn(async () => {
          if (reject) throw new DOMException('blocked', 'NotAllowedError');
        });
      }
    }
  );
  const h = renderHook(() => usePresentationAudio(state(), 'screen', true));
  await act(() => Promise.resolve()); // flush automatic activation
  expect(h.result.current.error).not.toBe('');
  expect(h.result.current.status).toBe('blocked');
  expect(h.result.current.enabled).toBe(false);
  reject = false;
  await act(async () => h.result.current.activate());
  expect(h.result.current.error).toBe('');
  expect(players).toHaveLength(12); // two activations of the bounded six-voice mixer
  h.unmount();
  void original;
});

it.each(presentationMusic)(
  'plays $title only on the selected screen, loops for days and resumes after interruption',
  async track => {
    vi.useFakeTimers();
    const s = state();
    s.audio = {
      builtin: track.id,
      status: 'playing',
      loop: true,
      at: Date.now() - (172800 + 20) * 1000,
      position: 12,
      volume: 0.65,
      fadeSeconds: 0,
    };
    const h = renderHook(({ online, state }) => usePresentationAudio(state, 'screen', online), {
      initialProps: { online: true, state: s },
    });
    await act(() => Promise.resolve()); // flush automatic activation
    players[1].duration = track.duration;
    await act(async () => h.rerender({ online: true, state: { ...s, audio: { ...s.audio } } }));
    expect(players[1].src).toBe(track.url);
    expect(players[1].loop).toBe(true);
    expect(players[1].currentTime).toBeCloseTo((172800 + 32) % track.duration);
    expect(players[1].volume).toBe(0.65);
    const calls = players[1].pause.mock.calls.length;
    h.rerender({ online: false, state: s });
    expect(players[1].pause.mock.calls.length).toBeGreaterThan(calls);
    act(() => vi.advanceTimersByTime(4000));
    await act(async () => h.rerender({ online: true, state: s }));
    expect(players[1].currentTime).toBeCloseTo((172800 + 36) % track.duration);
    const paused = { ...s, audio: { ...s.audio, status: 'paused', position: 40, at: Date.now() } };
    h.rerender({ online: true, state: paused });
    await act(async () =>
      h.rerender({
        online: true,
        state: { ...paused, audio: { ...paused.audio, status: 'playing', volume: 0.3 } },
      })
    );
    expect(players[1].currentTime).toBe(40);
    expect(players[1].volume).toBe(0.3);
    h.rerender({
      online: true,
      state: { ...s, audio: { ...s.audio, status: 'stopped', position: 0 } },
    });
    expect(players[1].currentTime).toBe(0);
    await act(async () =>
      h.rerender({
        online: true,
        state: { ...s, audio: { ...s.audio, position: 0, at: Date.now() } },
      })
    );
    expect(players[1].currentTime).toBe(0);
    const other = renderHook(() => usePresentationAudio(s, 'other', true));
    await act(async () => other.result.current.activate());
    expect(players.slice(-2).every(p => p.src !== track.url)).toBe(true);
    other.unmount();
    h.unmount();
    expect(players.every(p => p.src === '')).toBe(true);
  }
);

it('removes deferred metadata listeners and never restarts completed non-looping music', async () => {
  vi.useFakeTimers();
  const s = state();
  const track = presentationMusic[0];
  s.audio = {
    builtin: track.id,
    status: 'playing',
    loop: false,
    position: track.duration + 1,
    fadeSeconds: 0,
    at: Date.now(),
  };
  const h = renderHook(({ state }) => usePresentationAudio(state, 'screen', true), {
    initialProps: { state: s },
  });
  await act(() => Promise.resolve()); // flush automatic activation
  expect(players[1].play).toHaveBeenCalledTimes(1); // browser unlock only
  players[1].readyState = 0;
  await act(async () => h.rerender({ state: { ...s, audio: { ...s.audio, position: 0 } } }));
  const seek = players[1].addEventListener.mock.calls[0][1];
  h.unmount();
  expect(players[1].removeEventListener).toHaveBeenCalledWith('loadedmetadata', seek);
});

it('seeks to the current shared phase when slow metadata loading finishes', async () => {
  vi.useFakeTimers();
  const s = state();
  const h = renderHook(({ state }) => usePresentationAudio(state, 'screen', true), {
    initialProps: { state: s },
  });
  await act(() => Promise.resolve()); // flush automatic activation
  players[1].readyState = 0;
  await act(async () => h.rerender({ state: { ...s, audio: { ...s.audio } } }));
  act(() => vi.advanceTimersByTime(4000));
  act(() => {
    players[1].readyState = 1;
    players[1].addEventListener.mock.calls[0][1]();
  });
  expect(players[1].currentTime).toBe(19);
  h.unmount();
});

it('crossfades the sequence, restores both voices after days and preserves its finish boundary through controls', async () => {
  vi.useFakeTimers();
  const s = state();
  s.lease_until = Date.now() + 1000000;
  s.audio = {
    builtin: 'cinematic-sequence',
    status: 'playing',
    position: presentationSequence.cycleDuration * 1000 + 1.5,
    at: Date.now(),
    loop: true,
    volume: 0.65,
    fadeSeconds: 0,
  };
  const h = renderHook(({ state, online }) => usePresentationAudio(state, 'screen', online), {
    initialProps: { state: s, online: true },
  });
  await act(() => Promise.resolve()); // flush automatic activation
  const checkMix = (position: number, volume: number, loop = true, end?: number) => {
    for (const voice of presentationSequenceVoices(position, loop, end)) {
      const player = players.find(p => p.src === voice.track.url)!;
      expect(player.paused).toBe(false);
      expect(player.currentTime).toBeCloseTo(voice.position, 5);
      expect(player.volume).toBeCloseTo(volume * voice.gain, 5);
      expect(player.loop).toBe(false);
    }
  };
  checkMix(s.audio.position!, 0.65);
  const loads = players.map(player => player.load.mock.calls.length);
  await act(async () =>
    h.rerender({ state: { ...s, lease_until: s.lease_until! + 5000 }, online: true })
  );
  expect(players.map(player => player.load.mock.calls.length)).toEqual(loads);
  checkMix(s.audio.position!, 0.65);
  h.rerender({ state: s, online: false });
  expect(players.every(p => p.paused)).toBe(true);
  act(() => vi.advanceTimersByTime(5000));
  await act(async () => h.rerender({ state: s, online: true }));
  const resumed = s.audio.position! + 5;
  checkMix(resumed, 0.65);
  const end = presentationSequenceEnd(resumed);
  const stoppedLoop = {
    ...s,
    audio: { ...s.audio, loop: false, sequenceEndPosition: end, position: resumed, at: Date.now() },
  };
  await act(async () => h.rerender({ state: stoppedLoop, online: true }));
  checkMix(resumed, 0.65, false, end);
  const paused = { ...stoppedLoop, audio: { ...stoppedLoop.audio, status: 'paused', volume: 0.3 } };
  h.rerender({ state: paused, online: true });
  expect(players.every(p => p.paused)).toBe(true);
  await act(async () =>
    h.rerender({
      state: { ...paused, audio: { ...paused.audio, status: 'playing' } },
      online: true,
    })
  );
  checkMix(resumed, 0.3, false, end);
  await act(async () =>
    h.rerender({
      state: {
        ...paused,
        audio: { ...paused.audio, status: 'playing', position: end - 0.5, at: Date.now() },
      },
      online: true,
    })
  );
  act(() => vi.advanceTimersByTime(600));
  expect(players.every(p => p.paused)).toBe(true);
  h.rerender({
    state: { ...s, audio: { ...s.audio, status: 'stopped', position: 0, at: Date.now() } },
    online: true,
  });
  await act(async () =>
    h.rerender({
      state: { ...s, audio: { ...s.audio, position: 0, at: Date.now() } },
      online: true,
    })
  );
  checkMix(0, 0.65);
  h.unmount();
  expect(players.every(p => p.paused && !p.src)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('preloads sequence transitions and immediately restores hidden-tab phase without overriding output or lease', async () => {
  vi.useFakeTimers();
  const s = state();
  s.audio = {
    builtin: 'cinematic-sequence',
    status: 'playing',
    position: presentationSequence.tracks[0].duration - 6,
    at: Date.now(),
    loop: true,
    fadeSeconds: 0,
    volume: 0.65,
  };
  const h = renderHook(({ state }) => usePresentationAudio(state, 'screen', true), {
    initialProps: { state: s },
  });
  await act(() => Promise.resolve()); // flush automatic activation
  const upcoming = players.find(p => p.src === presentationSequence.tracks[1].url)!;
  expect(upcoming.paused).toBe(true);
  const before = Date.now();
  act(() => {
    vi.setSystemTime(before + 4500);
    globalThis.document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(upcoming.paused).toBe(false);
  expect(upcoming.currentTime).toBeCloseTo(1.5);
  expect(upcoming.volume).toBeCloseTo(0.325);
  act(() => vi.advanceTimersByTime(20000));
  expect(players.every(p => p.paused)).toBe(true);
  await act(async () =>
    h.rerender({ state: { ...s, audio_device_id: 'other', lease_until: Date.now() + 60000 } })
  );
  expect(players.every(p => p.paused)).toBe(true);
  h.unmount();
});

it('mixes a bounded transition over music, resumes only its remaining time and never replays an expired sound', async () => {
  vi.useFakeTimers();
  const s = state();
  s.lease_until = Date.now() + 100000;
  s.audio.transition = {
    builtin: 'test-tone',
    status: 'playing',
    position: 0,
    at: Date.now(),
    volume: 0.6,
    loop: false,
    durationSeconds: 3,
    fadeInSeconds: 1,
    fadeOutSeconds: 1,
    cueId: 'transition-one',
  };
  const h = renderHook(({ online, state }) => usePresentationAudio(state, 'screen', online), {
    initialProps: { online: true, state: s },
  });
  await act(() => Promise.resolve()); // flush automatic activation
  expect(players).toHaveLength(6);
  expect(players[1].volume).toBe(0.7);
  expect(players[4].volume).toBe(0);
  act(() => vi.advanceTimersByTime(500));
  expect(players[4].volume).toBeCloseTo(0.3);
  expect(players[1].volume).toBe(0.7);
  h.rerender({ online: false, state: s });
  expect(players.every(p => p.paused)).toBe(true);
  act(() => vi.advanceTimersByTime(2000));
  await act(async () => h.rerender({ online: true, state: s }));
  expect(players[4].currentTime).toBeCloseTo(2.5);
  expect(players[4].volume).toBeCloseTo(0.3);
  expect(players[1].currentTime).toBeCloseTo(17.5);
  act(() => vi.advanceTimersByTime(600));
  expect(players[4].paused).toBe(true);
  const count = players[4].play.mock.calls.length;
  await act(async () =>
    h.rerender({ online: true, state: { ...s, lease_until: s.lease_until! + 5000 } })
  );
  expect(players[4].play).toHaveBeenCalledTimes(count);
  expect(players[1].paused).toBe(false);
  h.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('crossfades slide music independently and replaces rapid transitions without allocating more voices', async () => {
  vi.useFakeTimers();
  const s = state();
  s.audio = {
    builtin: 'cinematic-hope',
    status: 'playing',
    position: 20,
    at: Date.now(),
    volume: 0.8,
    loop: true,
    fadeInSeconds: 0,
    fadeOutSeconds: 1,
    cueId: 'slide-one',
  };
  const h = renderHook(({ state }) => usePresentationAudio(state, 'screen', true), {
    initialProps: { state: s },
  });
  await act(() => Promise.resolve()); // flush automatic activation
  const next = {
    ...s,
    audio: {
      ...s.audio,
      builtin: 'cinematic-thriller' as const,
      cueId: 'slide-two',
      position: 0,
      fadeInSeconds: 1,
      transition: {
        builtin: 'test-tone' as const,
        status: 'playing',
        at: Date.now(),
        durationSeconds: 3,
        fadeInSeconds: 1,
        fadeOutSeconds: 1,
        cueId: 'first',
      },
    },
  };
  await act(async () => h.rerender({ state: next }));
  expect(players[1].paused).toBe(false);
  expect(players[3].volume).toBe(0);
  act(() => vi.advanceTimersByTime(500));
  expect(players[1].volume).toBeCloseTo(0.4);
  expect(players[3].volume).toBeCloseTo(0.4);
  for (let i = 0; i < 30; i++) {
    await act(async () =>
      h.rerender({
        state: {
          ...next,
          audio: {
            ...next.audio,
            transition: { ...next.audio.transition, at: Date.now(), cueId: `change-${i}` },
          },
        },
      })
    );
  }
  expect(players).toHaveLength(6);
  act(() => vi.advanceTimersByTime(1000));
  expect(players[1].paused).toBe(true);
  expect(players[3].volume).toBe(0.8);
  h.unmount();
  expect(players.every(p => p.paused && !p.src)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('preserves browser activation while unlocking takes longer than the mixer timer', async () => {
  vi.useFakeTimers();
  const unlock: (() => void)[] = [];
  vi.stubGlobal(
    'Audio',
    class extends FakeAudio {
      play = vi.fn(() => {
        this.paused = false;
        return this.src.startsWith('data:')
          ? new Promise<void>(resolve => unlock.push(resolve))
          : Promise.resolve();
      });
    }
  );
  const h = renderHook(() => usePresentationAudio(state(), 'screen', true));
  expect(h.result.current.status).toBe('activating');
  act(() => vi.advanceTimersByTime(500));
  expect(unlock).toHaveLength(6);
  expect(players.every(player => player.pause.mock.calls.length === 0)).toBe(true);
  await act(async () => {
    unlock.forEach(resolve => resolve());
  });
  expect(players[1].src).toBe('/api/studio/media/intro');
  expect(players[1].paused).toBe(false);
  expect(h.result.current.error).toBe('');
  h.unmount();
});

it('does not retry browser blocking on heartbeat, cue changes or reconnect', async () => {
  vi.stubGlobal(
    'Audio',
    class extends FakeAudio {
      play = vi.fn(async () => {
        throw new DOMException('blocked', 'NotAllowedError');
      });
    }
  );
  const s = state();
  const h = renderHook(({ current, online }) => usePresentationAudio(current, 'screen', online), {
    initialProps: { current: s, online: true },
  });
  await act(() => Promise.resolve());
  expect(h.result.current.status).toBe('blocked');
  h.rerender({ current: { ...s, lease_until: s.lease_until! + 5000 }, online: true });
  h.rerender({ current: { ...s, audio: { ...s.audio, cueId: 'new' } }, online: false });
  await act(async () => h.rerender({ current: s, online: true }));
  expect(players).toHaveLength(6);
  expect(players.every(p => p.play.mock.calls.length === 1 && p.paused)).toBe(true);
  h.unmount();
});

it.each(['NotAllowedError', 'NotSupportedError'])(
  'classifies %s on actual playback after a successful probe',
  async name => {
    let reject = true;
    vi.stubGlobal(
      'Audio',
      class extends FakeAudio {
        play = vi.fn(async () => {
          if (reject && !this.src.startsWith('data:')) throw new DOMException('failed', name);
          this.paused = false;
        });
      }
    );
    const h = renderHook(() => usePresentationAudio(state(), 'screen', true));
    await act(() => Promise.resolve());
    expect(h.result.current.status).toBe(name === 'NotAllowedError' ? 'blocked' : 'error');
    expect(h.result.current.enabled).toBe(false);
    expect(players.every(p => p.paused)).toBe(true);
    reject = false;
    await act(async () => h.result.current.activate());
    expect(h.result.current.status).toBe('ready');
    expect(players[7].paused).toBe(false);
    h.unmount();
  }
);

it.each(['offline', 'other-output', 'unmount'])(
  'cancels delayed activation on %s without late playback',
  async reason => {
    const resolve: (() => void)[] = [];
    vi.stubGlobal(
      'Audio',
      class extends FakeAudio {
        play = vi.fn(
          () =>
            new Promise<void>(done =>
              resolve.push(() => {
                this.paused = false;
                done();
              })
            )
        );
      }
    );
    const s = state();
    const h = renderHook(({ current, online }) => usePresentationAudio(current, 'screen', online), {
      initialProps: { current: s, online: true },
    });
    expect(h.result.current.status).toBe('activating');
    if (reason === 'unmount') h.unmount();
    else
      h.rerender({
        current: { ...s, audio_device_id: reason === 'other-output' ? 'other' : 'screen' },
        online: reason !== 'offline',
      });
    await act(async () => resolve.forEach(done => done()));
    expect(players.every(p => p.paused && p.src === '')).toBe(true);
    if (reason !== 'unmount') {
      expect(h.result.current.status).toBe('idle');
      h.unmount();
    }
  }
);

it('primes a local selection without playing until the shared output confirms it', async () => {
  const s = { ...state(), audio_device_id: 'other' };
  const h = renderHook(({ current }) => usePresentationAudio(current, 'screen', true), {
    initialProps: { current: s },
  });
  expect(players).toHaveLength(0);
  await act(async () => h.result.current.activate());
  expect(h.result.current.status).toBe('ready');
  expect(players.every(p => p.paused && p.src.startsWith('data:'))).toBe(true);
  await act(async () => h.rerender({ current: { ...s, audio_device_id: 'screen' } }));
  expect(players[1].paused).toBe(false);
  expect(players[1].src).toBe('/api/studio/media/intro');
  h.unmount();
});

it('supersedes automatic activation with a gesture and deduplicates concurrent gestures', async () => {
  const resolve: (() => void)[] = [];
  vi.stubGlobal(
    'Audio',
    class extends FakeAudio {
      play = vi.fn(() =>
        this.src.startsWith('data:')
          ? new Promise<void>(done => resolve.push(done))
          : Promise.resolve()
      );
    }
  );
  const h = renderHook(() => usePresentationAudio(state(), 'screen', true));
  let first!: Promise<void>;
  let second!: Promise<void>;
  act(() => {
    first = h.result.current.activate();
    second = h.result.current.activate();
  });
  expect(first).toBe(second);
  expect(players).toHaveLength(12);
  await act(async () => {
    resolve.forEach(done => done());
    await first;
  });
  expect(h.result.current.status).toBe('ready');
  expect(players.slice(0, 6).every(p => p.paused && !p.src)).toBe(true);
  expect(players[7].src).toBe('/api/studio/media/intro');
  h.unmount();
});

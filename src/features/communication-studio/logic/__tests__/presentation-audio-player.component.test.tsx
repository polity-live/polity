// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  createPresentationAudioPlayer,
  classifyPresentationAudioFailure,
} from '../presentation-audio-player';
import { presentationSequence } from '../presentation-audio';

class AudioVoice extends EventTarget {
  src = '';
  volume = 1;
  currentTime = 0;
  duration = Infinity;
  readyState = 1;
  loop = false;
  paused = true;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn();
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function setup() {
  vi.useFakeTimers();
  const voices: AudioVoice[] = [];
  vi.stubGlobal(
    'Audio',
    class extends AudioVoice {
      constructor() {
        super();
        voices.push(this);
      }
    }
  );
  const error = vi.fn();
  const mixer = createPresentationAudioPlayer(error);
  return { voices, mixer, error };
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

it('classifies arbitrary media failures and recovers from a failed cue without suppressing another cue', async () => {
  for (const failure of [null, 'offline', {}, { name: 'AbortError' }])
    expect(classifyPresentationAudioFailure(failure)).toBe('media');
  expect(classifyPresentationAudioFailure({ name: 'NotAllowedError' })).toBe('blocked');
  const { mixer, voices, error } = setup();
  await mixer.activate();
  voices[1].play.mockRejectedValueOnce(new Error('Unavailable media'));
  mixer.update({ assetId: 'missing', status: 'playing', fadeSeconds: 0, cueId: 'first' }, true);
  await flush();
  expect(error).toHaveBeenCalledWith(true, 'media');
  mixer.update({ assetId: 'next', status: 'playing', fadeSeconds: 0, cueId: 'next' }, true);
  await flush();
  expect(voices.some(voice => voice.src.endsWith('/next'))).toBe(true);
  const mediaError = new Event('error');
  voices[1].dispatchEvent(mediaError);
  expect(error).toHaveBeenCalledWith(true, 'media');
  mixer.dispose();
  const count = error.mock.calls.length;
  voices[1].dispatchEvent(mediaError);
  expect(error.mock.calls.length).toBe(count);
});

it('retains a media failure while another sequence voice acknowledges playback and ignores a queued disposed error', async () => {
  const registration = vi.spyOn(AudioVoice.prototype, 'addEventListener');
  const { mixer, voices, error } = setup();
  await mixer.activate();
  voices[1].play.mockRejectedValueOnce(new Error('first voice failed'));
  let acknowledge!: () => void;
  voices[0].play.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        acknowledge = () => {
          voices[0].paused = false;
          resolve();
        };
      })
  );
  mixer.update(
    {
      builtin: 'cinematic-sequence',
      status: 'playing',
      loop: true,
      position: presentationSequence.tracks[0].duration - 1,
      fadeSeconds: 0,
    },
    true
  );
  await flush();
  expect(error).toHaveBeenCalledWith(true, 'media');
  acknowledge();
  await flush();
  expect(voices.filter(voice => !voice.paused)).toHaveLength(1);
  mixer.dispose();
  const count = error.mock.calls.length;
  const queued = registration.mock.calls.find(([type]) => type === 'error')![1] as EventListener;
  queued(new Event('error'));
  expect(error.mock.calls.length).toBe(count);
});

it('uses default fades and unknown duration while retaining bounded lanes for rapid replacements', async () => {
  const { mixer, voices } = setup();
  await mixer.activate();
  mixer.update({ assetId: 'first', status: 'playing', loop: true, position: 3 }, true);
  await flush();
  expect(voices[1].currentTime).toBe(3);
  mixer.update({ assetId: 'first', status: 'paused' }, true);
  vi.advanceTimersByTime(1100);
  mixer.update({ assetId: 'second', status: 'playing' }, true);
  mixer.update({ assetId: 'third', status: 'playing' }, true);
  mixer.update({ assetId: 'fourth', status: 'playing' }, true);
  await flush();
  expect(voices).toHaveLength(6);
  voices.forEach(voice => {
    voice.readyState = 0;
  });
  mixer.update({ status: 'stopped', fadeOutSeconds: 0 }, true);
  vi.advanceTimersByTime(1100);
  expect(voices.every(voice => voice.paused)).toBe(true);
  mixer.dispose();
});

it.each(['disabled', 'disposed', 'expired', 'replaced'] as const)(
  'contains a playback acknowledgement after its lane is %s',
  async reason => {
    const { mixer, voices } = setup();
    await mixer.activate();
    let resolve!: () => void;
    voices[1].play.mockImplementationOnce(
      () =>
        new Promise<void>(done => {
          resolve = () => {
            voices[1].paused = false;
            done();
          };
        })
    );
    mixer.update({ assetId: 'first', status: 'playing', fadeSeconds: 0 }, true);
    if (reason === 'disabled') mixer.update({}, false);
    if (reason === 'disposed') mixer.dispose();
    if (reason === 'expired')
      mixer.update(
        { assetId: 'first', status: 'playing', fadeSeconds: 0 },
        true,
        0,
        Date.now() - 1
      );
    if (reason === 'replaced')
      mixer.update({ assetId: 'second', status: 'playing', fadeSeconds: 0 }, true);
    resolve();
    await flush();
    if (reason !== 'replaced') expect(voices[1].paused).toBe(true);
    else expect(voices[1].src).toContain('/second');
    mixer.dispose();
  }
);

it('drops an expired playback rejection and does not silence a newer use of the same lane', async () => {
  const { mixer, voices, error } = setup();
  await mixer.activate();
  let reject!: (failure: Error) => void;
  voices[1].play.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      })
  );
  mixer.update({ assetId: 'first', status: 'playing', fadeSeconds: 0 }, true);
  mixer.update({ assetId: 'first', status: 'playing', fadeSeconds: 0 }, true, 0, Date.now() - 1);
  reject(new Error('expired'));
  await flush();
  expect(error).not.toHaveBeenCalled();
  mixer.dispose();
});

it('bounds overlapping sequence voices in a transition lane and reuses a preloaded next track', async () => {
  const { mixer, voices } = setup();
  await mixer.activate();
  const boundary = presentationSequence.tracks[0].duration - 1;
  mixer.update(
    {
      transition: {
        builtin: 'cinematic-sequence',
        status: 'playing',
        position: boundary,
        fadeSeconds: 0,
      },
    },
    true
  );
  await flush();
  expect(voices.filter(voice => !voice.paused)).toHaveLength(1);
  mixer.update(
    {
      builtin: 'cinematic-sequence',
      status: 'playing',
      position: boundary - 4,
      at: Date.now(),
      fadeSeconds: 0,
    },
    true
  );
  vi.advanceTimersByTime(100);
  await flush();
  expect(voices).toHaveLength(6);
  mixer.dispose();
});

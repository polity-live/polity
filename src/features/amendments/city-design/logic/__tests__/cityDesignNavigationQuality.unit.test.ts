import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCityDesignNavigationQuality } from '../cityDesignNavigationQuality';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function harness(pixelRatio = 1.5) {
  const apply = vi.fn();
  const quality = createCityDesignNavigationQuality(apply, pixelRatio, {
    now: () => Date.now(),
    setTimeout,
    clearTimeout,
  });
  return { apply, quality };
}

describe('navigation quality', () => {
  it('keeps full quality for a stationary gesture and restores only after damping and the gesture finish', () => {
    const { quality, apply } = harness();
    quality.setGesture(true);
    vi.advanceTimersByTime(1000);
    expect(apply).not.toHaveBeenCalled();
    quality.cameraChanged();
    expect(apply).toHaveBeenLastCalledWith(true, 1);
    quality.setSettling(true);
    quality.setGesture(false);
    vi.advanceTimersByTime(1000);
    expect(quality.moving).toBe(true);
    quality.cameraChanged();
    quality.setSettling(false);
    vi.advanceTimersByTime(199);
    expect(quality.moving).toBe(true);
    vi.advanceTimersByTime(1);
    expect(apply).toHaveBeenLastCalledWith(false, 1.5);
    expect(quality.moving).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    quality.dispose();
  });

  it('uses twenty moving intervals and keeps the reduced ratio until navigation stops', () => {
    const { quality, apply } = harness();
    quality.recordFrame(0);
    quality.cameraChanged();
    quality.setGesture(true);
    for (let i = 0; i <= 19; i++) quality.recordFrame(i * 20);
    expect(apply).toHaveBeenCalledTimes(1);
    quality.recordFrame(400);
    expect(apply).toHaveBeenLastCalledWith(true, 0.75);
    for (let i = 1; i <= 60; i++) quality.recordFrame(400 + i * 8);
    expect(apply).toHaveBeenCalledTimes(2);
    quality.setGesture(false);
    vi.advanceTimersByTime(200);
    expect(apply).toHaveBeenLastCalledWith(false, 1.5);
    quality.cameraChanged();
    expect(apply).toHaveBeenLastCalledWith(true, 1);
    quality.dispose();
    vi.runAllTimers();
    quality.cameraChanged();
    quality.recordFrame(1000);
    expect(apply).toHaveBeenCalledTimes(4);
  });

  it('slides the sampling window without reducing fast frames or exceeding the device ratio', () => {
    const { quality, apply } = harness(0.6);
    quality.cameraChanged();
    for (let i = 0; i < 40; i++) quality.recordFrame(i * 16);
    expect(apply).toHaveBeenCalledExactlyOnceWith(true, 0.6);
    vi.advanceTimersByTime(100);
    quality.cameraChanged();
    vi.advanceTimersByTime(199);
    expect(quality.moving).toBe(true);
    vi.advanceTimersByTime(1);
    expect(apply).toHaveBeenLastCalledWith(false, 0.6);
    quality.dispose();
  });

  it('reschedules an early timer and cancels restoration when a gesture resumes', () => {
    const apply = vi.fn();
    let now = 0;
    let callback: () => void = vi.fn();
    const api = {
      now: () => now,
      setTimeout: vi.fn((value: () => void) => {
        callback = value;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }),
      clearTimeout: vi.fn(),
    };
    const quality = createCityDesignNavigationQuality(apply, 1.5, api);
    quality.cameraChanged();
    now = 100;
    callback();
    expect(api.setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 100);
    const stale = callback;
    quality.setGesture(true);
    now = 200;
    stale();
    expect(quality.moving).toBe(true);
    quality.setGesture(false);
    quality.dispose();
    callback();
    expect(apply).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ShowState } from '@/features/communication-studio/logic/live-contract';
const adapter = vi.hoisted(() => ({
  callbacks: [] as ((failed: boolean, reason?: 'blocked' | 'media') => void)[],
  instances: [] as any[],
}));
vi.mock('@/features/communication-studio/logic/presentation-audio-player', async original => ({
  ...(await original<
    typeof import('@/features/communication-studio/logic/presentation-audio-player')
  >()),
  createPresentationAudioPlayer: (
    callback: (failed: boolean, reason?: 'blocked' | 'media') => void
  ) => {
    const instance = { activate: vi.fn(async () => undefined), update: vi.fn(), dispose: vi.fn() };
    adapter.callbacks.push(callback);
    adapter.instances.push(instance);
    return instance;
  },
}));
import { usePresentationAudio } from '../usePresentationAudio';
afterEach(() => {
  adapter.callbacks.length = 0;
  adapter.instances.length = 0;
});

it('accepts successful mixer callbacks, treats unspecified failures as media errors and ignores disposed callbacks', async () => {
  const state = {
    audio_device_id: 'screen',
    running: true,
    lease_until: Date.now() + 10000,
    audio: {},
  } as ShowState;
  const h = renderHook(() => usePresentationAudio(state, 'screen', true));
  await act(() => Promise.resolve());
  const callback = adapter.callbacks[0];
  act(() => callback(false));
  expect(h.result.current.status).toBe('ready');
  act(() => callback(true));
  expect(h.result.current.status).toBe('error');
  expect(adapter.instances[0].dispose).toHaveBeenCalled();
  act(() => callback(true, 'blocked'));
  expect(h.result.current.status).toBe('error');
  await act(() => h.result.current.activate());
  expect(h.result.current.status).toBe('ready');
  act(() => callback(false));
  expect(h.result.current.status).toBe('ready');
  const current = adapter.callbacks.at(-1)!;
  h.unmount();
  act(() => current(true, 'blocked'));
  expect(adapter.instances.at(-1)!.dispose).toHaveBeenCalled();
});

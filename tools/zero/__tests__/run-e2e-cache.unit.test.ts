import { EventEmitter } from 'node:events';
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  discoverDescendants,
  livingDescendants,
  readProcesses,
  runCacheCli,
  superviseCache,
} from '../run-e2e-cache.mjs';

vi.mock('node:fs', async importOriginal => ({
  ...(await importOriginal<typeof import('node:fs')>()),
}));
vi.mock('node:child_process', async importOriginal => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
}));

const processInfo = (parent: number, born: string, state = 'S') => ({ parent, born, state });
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('isolated Linux Zero lifecycle', () => {
  it('waits for the child exit notification without signaling an already reaped process', async () => {
    vi.useFakeTimers();
    const child = Object.assign(new EventEmitter(), { pid: 10 });
    const parent = new EventEmitter();
    const processes = new Map([[10, processInfo(1, 'a')]]);
    const signal = vi.fn(() => {
      processes.clear();
    });
    const logger = { error: vi.fn() };
    const result = superviseCache({
      spawnChild: (() => child) as never,
      snapshot: () => processes,
      processState: parent as never,
      signal,
      logger,
      graceMs: 100,
    });
    parent.emit('SIGTERM');
    await vi.advanceTimersByTimeAsync(300);
    expect(signal.mock.calls).toHaveLength(1);
    expect(logger.error).not.toHaveBeenCalled();
    child.emit('exit', 0, null);
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe(0);
  });
  it('propagates the supervised exit status through the CLI', async () => {
    const processState = { exitCode: 0 };
    await runCacheCli({ runCache: async () => 7, processState });
    expect(processState.exitCode).toBe(7);
  });

  it('tolerates disappearing proc entries and exposes actual permission failures', () => {
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['1', '2'] as never);
    const read = vi.spyOn(fs, 'readFileSync');
    read.mockImplementationOnce(() => {
      throw Object.assign(new Error(), { code: 'ENOENT' });
    });
    read.mockImplementationOnce(() => {
      throw Object.assign(new Error(), { code: 'ESRCH' });
    });
    expect(readProcesses().size).toBe(0);
    read.mockImplementationOnce(() => {
      throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
    });
    expect(() => readProcesses()).toThrow('permission denied');
  });

  it('uses the installed CLI and native process signals by default', async () => {
    vi.useFakeTimers();
    const child = Object.assign(new EventEmitter(), { pid: 10 });
    const spawn = vi.spyOn(childProcess, 'spawn').mockReturnValue(child as never);
    const readDir = vi.spyOn(fs, 'readdirSync').mockReturnValue(['10'] as never);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `10 (node) S 1 ${Array(17).fill('0').join(' ')} 99 0`
    );
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
      readDir.mockReturnValue([]);
      child.emit('exit', 0, null);
      return true;
    });
    const existing = process.listeners('SIGINT');
    const result = superviseCache();
    const stop = process.listeners('SIGINT').find(listener => !existing.includes(listener))!;
    stop('SIGINT');
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe(0);
    expect(spawn).toHaveBeenCalledWith(
      process.execPath,
      [expect.stringMatching(/zero[\\/]out[\\/]zero[\\/]src[\\/]cli.js$/)],
      { detached: true, stdio: 'inherit' }
    );
    expect(kill).toHaveBeenCalledWith(10, 'SIGTERM');
  });

  it.each([
    [null, 'SIGKILL', 1],
    [null, null, 0],
    [7, null, 7],
  ])('preserves early exit %s / %s', async (code, childSignal, expected) => {
    vi.useFakeTimers();
    const child = Object.assign(new EventEmitter(), { pid: 10 });
    const result = superviseCache({
      spawnChild: (() => child) as never,
      snapshot: () => new Map(),
      processState: new EventEmitter() as never,
    });
    child.emit('exit', code, childSignal);
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe(expected);
  });

  it.each(['ESRCH', 'EPERM'])('handles a shutdown signal race with %s', async code => {
    vi.useFakeTimers();
    const child = Object.assign(new EventEmitter(), { pid: 10 });
    const parent = new EventEmitter();
    const processes = new Map([[10, processInfo(1, 'a')]]);
    const result = superviseCache({
      spawnChild: (() => child) as never,
      snapshot: () => processes,
      processState: parent as never,
      signal: () => {
        throw Object.assign(new Error(code), { code });
      },
    });
    if (code === 'ESRCH') expect(() => parent.emit('SIGINT')).not.toThrow();
    else expect(() => parent.emit('SIGINT')).toThrow('EPERM');
    processes.clear();
    child.emit('exit', 0, null);
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe(0);
  });

  it('does not signal a PID that was replaced before shutdown', async () => {
    vi.useFakeTimers();
    const child = Object.assign(new EventEmitter(), { pid: 10 });
    const parent = new EventEmitter();
    const processes = new Map([[10, processInfo(1, 'a')]]);
    const signal = vi.fn();
    const result = superviseCache({
      spawnChild: (() => child) as never,
      snapshot: () => processes,
      processState: parent as never,
      signal,
    });
    processes.set(10, processInfo(1, 'replacement'));
    parent.emit('SIGTERM');
    child.emit('exit', 0, null);
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe(0);
    expect(signal).not.toHaveBeenCalled();
  });
  it('reads process identity even when a command contains spaces and parentheses', () => {
    const root = mkdtempSync(join(tmpdir(), 'zero-proc-'));
    try {
      mkdirSync(join(root, '12'));
      mkdirSync(join(root, '13'));
      mkdirSync(join(root, 'self'));
      writeFileSync(
        join(root, '12', 'stat'),
        `12 (node (worker)) S 11 ${Array(17).fill('0').join(' ')} 98765 0`
      );
      expect(readProcesses(root)).toEqual(new Map([[12, processInfo(11, '98765')]]));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('retains detached orphan ownership but excludes siblings, zombies and reused PIDs', () => {
    const owned = new Map([[10, 'a']]);
    const initial = new Map([
      [12, processInfo(11, 'c')],
      [11, processInfo(10, 'b')],
      [10, processInfo(1, 'a')],
      [90, processInfo(1, 'unrelated')],
    ]);
    discoverDescendants(owned, initial);
    expect([...owned.keys()].sort()).toEqual([10, 11, 12]);
    const after = new Map([
      [10, processInfo(1, 'reused')],
      [11, processInfo(1, 'b', 'Z')],
      [12, processInfo(1, 'c')],
      [13, processInfo(10, 'not-ours')],
      [90, processInfo(1, 'unrelated')],
    ]);
    discoverDescendants(owned, after);
    expect(livingDescendants(owned, after)).toEqual([12]);
    expect(owned.has(13)).toBe(false);
  });

  it('reaps a detached worker that keeps stdout open after its parent exits', async () => {
    vi.useFakeTimers();
    const child = Object.assign(new EventEmitter(), { pid: 10 });
    const parent = new EventEmitter();
    const processes = new Map([
      [10, processInfo(1, 'a')],
      [11, processInfo(10, 'b')],
      [90, processInfo(1, 'other')],
    ]);
    const signal = vi.fn((pid: number, name: string) => {
      if (name === 'SIGTERM') {
        processes.delete(10);
        processes.set(11, processInfo(1, 'b'));
        child.emit('exit', 0, null);
      } else processes.delete(pid);
    });
    const result = superviseCache({
      spawnChild: (() => child) as never,
      processState: parent as never,
      snapshot: () => processes,
      signal,
      graceMs: 500,
      logger: { error: vi.fn() },
    });
    parent.emit('SIGTERM');
    parent.emit('SIGTERM');
    await vi.advanceTimersByTimeAsync(700);
    await expect(result).resolves.toBe(0);
    expect(signal.mock.calls).toEqual([
      [10, 'SIGTERM'],
      [11, 'SIGKILL'],
    ]);
    expect(processes.has(90)).toBe(true);
    expect(parent.listenerCount('SIGTERM')).toBe(0);
    expect(parent.listenerCount('SIGINT')).toBe(0);
  });

  it('preserves an unexpected cache failure and cleans up its surviving workers', async () => {
    vi.useFakeTimers();
    const child = Object.assign(new EventEmitter(), { pid: 10 });
    const processes = new Map([
      [10, processInfo(1, 'a')],
      [11, processInfo(10, 'b')],
    ]);
    const result = superviseCache({
      spawnChild: (() => child) as never,
      processState: new EventEmitter() as never,
      snapshot: () => processes,
      signal: (pid: number) => {
        processes.delete(pid);
      },
      graceMs: 500,
      logger: { error: vi.fn() },
    });
    processes.delete(10);
    processes.set(11, processInfo(1, 'b'));
    child.emit('exit', 7, null);
    await vi.advanceTimersByTimeAsync(700);
    await expect(result).resolves.toBe(7);
    expect(processes.size).toBe(0);
  });

  it('fails closed when the cache cannot be launched', async () => {
    const child = new EventEmitter();
    const result = superviseCache({
      spawnChild: (() => child) as never,
      logger: { error: vi.fn() },
    });
    child.emit('error', new Error('spawn failed'));
    await expect(result).resolves.toBe(1);
  });
});

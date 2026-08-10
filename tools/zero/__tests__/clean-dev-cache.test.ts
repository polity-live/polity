import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cleanZeroReplica,
  isZeroCachePortInUse,
  runCleanZeroReplicaCli,
  ZERO_REPLICA_FILES,
} from '../clean-dev-cache.mjs';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function socketThat(event: 'connect' | 'error' | 'timeout') {
  return () => {
    const socket = new EventEmitter() as EventEmitter & {
      setTimeout: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    };
    socket.setTimeout = vi.fn();
    socket.destroy = vi.fn();
    queueMicrotask(() => socket.emit(event));
    return socket;
  };
}

describe('local Zero replica cleanup', () => {
  it('maps successful and blocked cleanup results to CLI process state', async () => {
    const processState = {};
    await expect(
      runCleanZeroReplicaCli({ clean: async () => ({ cleaned: true }), processState })
    ).resolves.toEqual({ cleaned: true });
    expect(processState).not.toHaveProperty('exitCode');

    await expect(
      runCleanZeroReplicaCli({
        clean: async () => ({ cleaned: false, reason: 'port-in-use' }),
        processState,
      })
    ).resolves.toEqual({ cleaned: false, reason: 'port-in-use' });
    expect(processState).toHaveProperty('exitCode', 1);
  });

  it('detects connect, error, and timeout outcomes without a real socket', async () => {
    await expect(
      isZeroCachePortInUse({ connectionFactory: socketThat('connect'), timeoutMs: 10 })
    ).resolves.toBe(true);
    await expect(
      isZeroCachePortInUse({ connectionFactory: socketThat('error'), timeoutMs: 10 })
    ).resolves.toBe(false);
    await expect(
      isZeroCachePortInUse({ connectionFactory: socketThat('timeout'), timeoutMs: 10 })
    ).resolves.toBe(false);
    await expect(isZeroCachePortInUse({ connectionFactory: socketThat('error') })).resolves.toBe(
      false
    );
    await expect(isZeroCachePortInUse({ timeoutMs: 10 })).resolves.toEqual(expect.any(Boolean));
  });

  it('deletes only exact replica files inside an isolated project root', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-zero-clean-'));
    roots.push(projectRoot);
    for (const file of ZERO_REPLICA_FILES) fs.writeFileSync(path.join(projectRoot, file), 'data');
    fs.writeFileSync(path.join(projectRoot, 'keep.db'), 'keep');
    const logger = { log: vi.fn(), error: vi.fn() };

    await expect(
      cleanZeroReplica({ projectRoot, portInUse: async () => false, logger })
    ).resolves.toEqual({ cleaned: true });

    expect(ZERO_REPLICA_FILES.every(file => !fs.existsSync(path.join(projectRoot, file)))).toBe(
      true
    );
    expect(fs.existsSync(path.join(projectRoot, 'keep.db'))).toBe(true);
    expect(logger.log).toHaveBeenCalledOnce();
  });

  it('does not delete files while the Zero port is active', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-zero-clean-'));
    roots.push(projectRoot);
    fs.writeFileSync(path.join(projectRoot, ZERO_REPLICA_FILES[0]), 'data');
    const logger = { log: vi.fn(), error: vi.fn() };

    await expect(
      cleanZeroReplica({ projectRoot, portInUse: async () => true, logger })
    ).resolves.toEqual({ cleaned: false, reason: 'port-in-use' });
    expect(fs.existsSync(path.join(projectRoot, ZERO_REPLICA_FILES[0]))).toBe(true);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('uses default root and logger with an injected non-writing removal boundary', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(cleanZeroReplica({ remove, portInUse: async () => false })).resolves.toEqual({
      cleaned: true,
    });
    expect(remove).toHaveBeenCalledTimes(ZERO_REPLICA_FILES.length);
    expect(log).toHaveBeenCalledOnce();
  });

  it('can use default cleanup dependencies without deleting while the port guard is active', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-zero-clean-'));
    roots.push(projectRoot);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(cleanZeroReplica({ projectRoot, portInUse: async () => true })).resolves.toEqual({
      cleaned: false,
      reason: 'port-in-use',
    });
    expect(error).toHaveBeenCalledOnce();
  });

  it('uses the real default port guard with an isolated non-writing cleanup boundary', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-zero-clean-'));
    roots.push(projectRoot);
    const remove = vi.fn().mockResolvedValue(undefined);
    const logger = { log: vi.fn(), error: vi.fn() };

    const result = await cleanZeroReplica({ projectRoot, remove, logger });

    expect(result.cleaned).toEqual(expect.any(Boolean));
    if (result.cleaned) {
      expect(remove).toHaveBeenCalledTimes(ZERO_REPLICA_FILES.length);
    } else {
      expect(remove).not.toHaveBeenCalled();
      expect(result).toEqual({ cleaned: false, reason: 'port-in-use' });
    }
  });
});

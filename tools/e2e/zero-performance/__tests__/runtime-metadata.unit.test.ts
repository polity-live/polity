import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { runtimeMetadata } from '../execution';
import { linuxEnvironment } from '../linux-runtime.mjs';
const files = vi.hoisted(() => ({
  version: '1.9.0',
  lock: 'reviewed revision-owned lock',
  source: 'original SDK source',
}));
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async (file: string) =>
    file.endsWith('package.json')
      ? JSON.stringify({ version: files.version })
      : Buffer.from(file.endsWith('table-source.js') ? files.source : files.lock)
  ),
}));
beforeEach(() => {
  vi.stubEnv('ZERO_INITIAL_SYNC_TEXT_COPY', 'true');
  vi.stubEnv('ZERO_YIELD_THRESHOLD_MS', '4000');
});
afterEach(() => {
  vi.unstubAllEnvs();
  files.version = '1.9.0';
  files.lock = 'reviewed revision-owned lock';
  files.source = 'original SDK source';
});

describe('owned Docker benchmark environment', () => {
  const environment = {
    ZERO_UPSTREAM_DB: 'postgres://owner@127.0.0.1:15625/db',
    ZERO_CVR_DB: 'postgres://owner@127.0.0.1:15625/db',
    ZERO_CHANGE_DB: 'postgres://owner@127.0.0.1:15625/db',
    ZERO_INITIAL_SYNC_TEXT_COPY: 'true',
    ZERO_YIELD_THRESHOLD_MS: '4000',
    ZERO_QUERY_URL: 'http://localhost:15620/api/query',
    ZERO_MUTATE_URL: 'http://localhost:15620/api/mutate',
    ZERO_PERFORMANCE_SCAN_STATUS_RUNTIME_ID: '00000000-0000-4000-8000-000000000001',
    ZERO_PERFORMANCE_OUTPUT: 'host-only-artifacts',
    NODE_OPTIONS: '--import=untrusted-input',
  };
  it('preserves the direct runtime identity while installing only the owned Docker scan adapter', () => {
    const original = { ...environment };
    const mapped = linuxEnvironment(environment, { scanStatus: true });
    expect(mapped).toMatchObject({
      ZERO_PERFORMANCE_SCAN_STATUS: '1',
      ZERO_PERFORMANCE_SCAN_STATUS_LOG: '/benchmark/sqlite-scan-status.ndjson',
      ZERO_PERFORMANCE_SCAN_STATUS_RUNTIME_ID: environment.ZERO_PERFORMANCE_SCAN_STATUS_RUNTIME_ID,
      NODE_OPTIONS: '--import=/scan-adapter/sqlite-scan-preload.mjs',
      ZERO_REPLICA_FILE: '/replica/zero.db',
      ZERO_INITIAL_SYNC_TEXT_COPY: 'true',
      ZERO_YIELD_THRESHOLD_MS: '4000',
      ZERO_QUERY_URL: 'http://host.docker.internal:15620/api/query',
    });
    expect(mapped).not.toHaveProperty('ZERO_PERFORMANCE_OUTPUT');
    expect(environment).toEqual(original);
    expect(linuxEnvironment(environment)).not.toHaveProperty(
      'ZERO_PERFORMANCE_SCAN_STATUS_RUNTIME_ID'
    );
  });
  it.each(['', 'not-a-runtime-uuid'])(
    'rejects unavailable Docker runtime identity %s',
    runtimeID => {
      expect(() =>
        linuxEnvironment(
          { ...environment, ZERO_PERFORMANCE_SCAN_STATUS_RUNTIME_ID: runtimeID },
          { scanStatus: true }
        )
      ).toThrow('runtime identity');
    }
  );
});
describe('shared benchmark runtime fingerprint', () => {
  it('matches collector and worker fingerprints and detects changed revision dependencies', async () => {
    const collector = await runtimeMetadata(158);
    expect(await runtimeMetadata(158)).toEqual(collector);
    expect(collector).toMatchObject({
      zero: '1.9.0',
      initialSyncCopyFormat: 'text',
      ivmYieldThresholdMs: 4000,
      ivmPriorityYieldThresholdMs: 1000,
      schemaTables: 158,
      lockSHA256: createHash('sha256').update(files.lock).digest('hex'),
      scanStatusSourceSHA256: createHash('sha256').update(files.source).digest('hex'),
    });
    files.lock = 'different revision-owned lock';
    expect((await runtimeMetadata(158)).lockSHA256).not.toBe(collector.lockSHA256);
    files.source = 'changed analyzer source';
    expect((await runtimeMetadata(158)).scanStatusSourceSHA256).not.toBe(
      collector.scanStatusSourceSHA256
    );
  });
  it('fails closed on missing runtime evidence', async () => {
    await expect(runtimeMetadata(0)).rejects.toThrow('Invalid runtime schema');
    files.version = '';
    await expect(runtimeMetadata(158)).rejects.toThrow('Missing Zero runtime version');
    files.version = '1.9.0';
    files.lock = '';
    await expect(runtimeMetadata(158)).rejects.toThrow('Missing runtime lockfile');
  });
  it.each([undefined, '', 'false', '1'])(
    'requires the explicit supported text COPY option %s before recording runtime evidence',
    async option => {
      vi.stubEnv('ZERO_INITIAL_SYNC_TEXT_COPY', option);
      await expect(runtimeMetadata(158)).rejects.toThrow('explicit text COPY');
    }
  );
  it.each([undefined, '', '10', '1000', '4001', '4000.0'])(
    'requires the same explicit bounded IVM yield option %s before recording either revision',
    async option => {
      vi.stubEnv('ZERO_YIELD_THRESHOLD_MS', option);
      await expect(runtimeMetadata(158)).rejects.toThrow('shared 4000-ms IVM yield threshold');
    }
  );
});

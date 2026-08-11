import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { actorUser } from '../../../e2e/fixtures/auth';
import { normalizeCleanupResources } from '../../../e2e/fixtures/cleanup';
import {
  actorAuthStatePath,
  deterministicE2EUuid,
  e2eActorId,
  e2eTestNamespace,
} from '../../../e2e/fixtures/run';

const E2E_ROOT = path.resolve(import.meta.dirname, '../../../e2e');
const PLAYWRIGHT_CONFIG = path.resolve(E2E_ROOT, '../playwright.config.ts');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('E2E fixture lifecycle contract', () => {
  it('derives deterministic, shard- and test-scoped actor identities', () => {
    vi.stubEnv('E2E_RUN_ID', 'contract-run');
    vi.stubEnv('E2E_SHARD', 'desktop-1');

    const firstTest = e2eTestNamespace({ testId: 'group creates', retry: 0, repeatEachIndex: 0 });
    const secondTest = e2eTestNamespace({ testId: 'event creates', retry: 0, repeatEachIndex: 0 });
    const primary = actorUser(firstTest);
    const collaborator = actorUser(firstTest, 'collaborator');

    expect(firstTest).not.toBe(secondTest);
    expect(primary.id).toBe(e2eActorId(firstTest, 'primary'));
    expect(primary.id).not.toBe(collaborator.id);
    expect(primary.email).not.toBe(collaborator.email);
    expect(primary.namespace).toBe(firstTest);
    expect(primary.storageStatePath).toBe(actorAuthStatePath(firstTest, 'primary'));
    expect(primary.storageStatePath).not.toBe(collaborator.storageStatePath);

    vi.stubEnv('E2E_SHARD', 'desktop-2');
    expect(e2eTestNamespace({ testId: 'group creates', retry: 0, repeatEachIndex: 0 })).not.toBe(
      firstTest
    );
  });

  it('preserves actor-specific identities when the run namespace reaches its maximum length', () => {
    vi.stubEnv('E2E_RUN_ID', 'run-id-that-consumes-the-full-budget');
    vi.stubEnv('E2E_SHARD', 'chromium-desktop-headed-pr');

    const namespace = e2eTestNamespace({
      testId: 'critical network linking with a second administrator',
      retry: 0,
      repeatEachIndex: 0,
    });
    const primary = actorUser(namespace, 'primary');
    const approver = actorUser(namespace, 'network-approver');

    expect(namespace).toHaveLength(58);
    expect(primary.email.split('@')[0]).toHaveLength(58);
    expect(approver.email.split('@')[0]).toHaveLength(58);
    expect(primary).toEqual(actorUser(namespace, 'primary'));
    expect(primary.id).not.toBe(approver.id);
    expect(primary.email).not.toBe(approver.email);
    expect(primary.storageStatePath).not.toBe(approver.storageStatePath);
  });

  it('accepts only exact UUID cleanup resources and deduplicates them', () => {
    vi.stubEnv('E2E_RUN_ID', 'contract-run');
    const actorId = deterministicE2EUuid('actor');
    const entityId = deterministicE2EUuid('entity');

    expect(
      normalizeCleanupResources({
        actorIds: [actorId, actorId],
        entityIds: [entityId, actorId, entityId],
      })
    ).toEqual({
      actorIds: [actorId],
      entityIds: [entityId, actorId],
      resourceIds: [actorId, entityId],
    });
    expect(() => normalizeCleanupResources({ actorIds: [] })).toThrow(/exact actor ID/);
    expect(() => normalizeCleanupResources({ actorIds: ['E2E-contract-run%'] })).toThrow(
      /invalid actor ID/
    );
  });

  it('keeps test ownership exact in fixtures and teardown', async () => {
    const [
      fixtureSource,
      cleanupSource,
      databaseSource,
      playwrightSource,
      setupSource,
      teardownSource,
      networkJourneySource,
    ] = await Promise.all([
      fs.readFile(path.join(E2E_ROOT, 'fixtures/test.ts'), 'utf8'),
      fs.readFile(path.join(E2E_ROOT, 'fixtures/cleanup.ts'), 'utf8'),
      fs.readFile(path.join(E2E_ROOT, 'fixtures/db.ts'), 'utf8'),
      fs.readFile(PLAYWRIGHT_CONFIG, 'utf8'),
      fs.readFile(path.join(E2E_ROOT, 'global-setup.ts'), 'utf8'),
      fs.readFile(path.join(E2E_ROOT, 'global-teardown.ts'), 'utf8'),
      fs.readFile(path.join(E2E_ROOT, 'critical/network-linking.spec.ts'), 'utf8'),
    ]);

    expect(fixtureSource).not.toMatch(/scope:\s*['"]worker['"]/);
    expect(fixtureSource).not.toContain('workerStorageState');
    expect(fixtureSource).toContain('cleanupE2ERows({ actorIds:');
    expect(fixtureSource).toContain('registerEntityId');
    expect(cleanupSource).not.toMatch(/\b(?:like|ilike)\s+\$\{/i);
    expect(cleanupSource).not.toContain('options.prefix');
    expect(databaseSource).toContain('statement_timeout: 10_000');
    expect(databaseSource).toContain('lock_timeout: 3_000');
    expect(databaseSource).toContain('idle_in_transaction_session_timeout: 10_000');
    expect(playwrightSource).toContain(
      'globalTimeout: process.env.CI ? 15 * 60 * 1000 : undefined'
    );
    expect(playwrightSource).toContain("['line']");
    expect(playwrightSource).toContain("['blob',");
    expect(setupSource).toContain('await waitForZeroReady()');
    expect(teardownSource).not.toContain('cleanupE2ERows');
    expect(teardownSource).toContain('await closeDb()');
    expect(networkJourneySource).toContain("e2eRun.actor('network-approver')");
  });
});

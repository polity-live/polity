import { createHash } from 'node:crypto';
import path from 'node:path';

function safeToken(value: string, maxLength = 32) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength);
}

function shortHash(value: string, length = 12) {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}

export function e2eRunId() {
  const explicit = process.env.E2E_RUN_ID;
  if (explicit) return safeToken(explicit);

  const githubRun = process.env.GITHUB_RUN_ID;
  if (githubRun) {
    return safeToken(`gh-${githubRun}-${process.env.GITHUB_RUN_ATTEMPT ?? '1'}`);
  }

  return `local-${process.pid}`;
}

export function e2eShardId() {
  return safeToken(process.env.E2E_SHARD ?? 'local', 20) || 'local';
}

export function deterministicE2EUuid(scope: string) {
  const hex = createHash('sha256').update(`${e2eRunId()}:${scope}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function actorAuthStatePath(testNamespace: string, actor: string) {
  const actorToken = safeToken(actor, 24);
  if (!actorToken) throw new Error('E2E actor names must contain an alphanumeric character.');
  return path.join(
    process.cwd(),
    'e2e',
    '.auth',
    e2eRunId(),
    e2eShardId(),
    `${shortHash(testNamespace, 16)}-${actorToken}.json`
  );
}

export function e2eRunNamespace() {
  return `E2E-${safeToken(e2eRunId(), 20)}-${e2eShardId()}`;
}

export function e2eTestNamespace(testInfo: {
  testId: string;
  retry: number;
  repeatEachIndex: number;
}) {
  const identity = `${e2eRunId()}:${e2eShardId()}:${testInfo.testId}:${testInfo.retry}:${testInfo.repeatEachIndex}`;
  return `${e2eRunNamespace()}-${shortHash(identity)}`;
}

export function e2eActorId(testNamespace: string, actor: string) {
  return deterministicE2EUuid(`actor:${testNamespace}:${actor}`);
}

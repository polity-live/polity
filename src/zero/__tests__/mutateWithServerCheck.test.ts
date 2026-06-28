import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  serverConfirmed,
  trackServerFinalization,
  waitForClientApply,
  type MutationResultLike,
} from '../mutate-with-server-check';

function mutationResult(overrides: Partial<MutationResultLike> = {}): MutationResultLike {
  return {
    server: Promise.resolve({ type: 'success' }),
    ...overrides,
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('mutate-with-server-check', () => {
  it('waits for client optimistic apply', async () => {
    const order: string[] = [];
    const result = mutationResult({
      client: Promise.resolve().then(() => {
        order.push('client');
      }),
    });

    const pending = waitForClientApply(result).then(() => {
      order.push('done');
    });

    expect(order).toEqual([]);
    await pending;
    expect(order).toEqual(['client', 'done']);
  });

  it('resolves client apply immediately when the result has no client promise', async () => {
    await expect(waitForClientApply(mutationResult())).resolves.toBeUndefined();
  });

  it('tracks server success in the background', async () => {
    const onSuccess = vi.fn();

    trackServerFinalization(mutationResult(), { onSuccess });
    await flushPromises();

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('tracks server error results in the background', async () => {
    const onError = vi.fn();

    trackServerFinalization(
      mutationResult({
        server: Promise.resolve({
          type: 'error',
          error: { type: 'server', message: 'Rejected' },
        }),
      }),
      { onError }
    );
    await flushPromises();

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Rejected' }));
  });

  it('tracks thrown server rejection in the background', async () => {
    const onError = vi.fn();

    trackServerFinalization(
      mutationResult({
        server: Promise.reject(new Error('Network failed')),
      }),
      { onError }
    );
    await flushPromises();

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Network failed' }));
  });

  it('can ignore Zero-close server cancellations', async () => {
    const onError = vi.fn();

    trackServerFinalization(
      mutationResult({
        server: Promise.reject(new Error('Zero was explicitly closed by calling zero.close()')),
      }),
      { onError, ignoreZeroClosed: true }
    );
    await flushPromises();

    expect(onError).not.toHaveBeenCalled();
  });

  it('keeps serverConfirmed as a server-gated helper', async () => {
    await expect(
      serverConfirmed(
        mutationResult({
          server: Promise.resolve({
            type: 'error',
            error: { type: 'server', message: 'Authoritative failure' },
          }),
        })
      )
    ).rejects.toThrow('Authoritative failure');
  });

  it('keeps production serverConfirmed call sites limited to server-gated flows', () => {
    const repoRoot = process.cwd();
    const sourceRoot = join(repoRoot, 'src');
    const allowedFiles = new Set([
      'features/decision-terminal/hooks/useDecisionVoteDialogController.ts',
      'features/vote-cast/hooks/useVotePasswordConfirmation.ts',
      'zero/voting-password/useVotingPasswordActions.ts',
    ]);
    const actualFiles = new Set<string>();

    for (const filePath of walkTypeScriptFiles(sourceRoot)) {
      const relativePath = relative(sourceRoot, filePath).replaceAll('\\', '/');
      if (
        relativePath.includes('/__tests__/') ||
        relativePath === 'zero/mutate-with-server-check.ts'
      ) {
        continue;
      }

      const source = readFileSync(filePath, 'utf8');
      if (/\bawait\s+serverConfirmed\s*\(/.test(source)) {
        actualFiles.add(relativePath);
      }
    }

    expect(actualFiles).toEqual(allowedFiles);
  });

  it('does not await raw Zero mutations in production code', () => {
    const repoRoot = process.cwd();
    const sourceRoot = join(repoRoot, 'src');
    const violations: string[] = [];

    for (const filePath of walkTypeScriptFiles(sourceRoot)) {
      const relativePath = relative(sourceRoot, filePath).replaceAll('\\', '/');
      if (
        relativePath.includes('/__tests__/') ||
        relativePath === 'zero/mutate-with-server-check.ts'
      ) {
        continue;
      }

      const source = readFileSync(filePath, 'utf8');
      if (/\bawait\s+zero\.mutate\s*\(/.test(source)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps direct action awaits limited to explicitly client-applied wrappers', () => {
    const repoRoot = process.cwd();
    const sourceRoot = join(repoRoot, 'src');
    const allowedAwaitedActions = new Set([
      'commonActions.syncEntityHashtags',
      'userActions.updateProfileClientApplied',
    ]);
    const actionAwaitPattern =
      /\bawait\s+((?:actions|meetingActions|eventActions|voteActionsHook|electionActions|agendaActions|userActions|todoActions|blogActions|commonActions|mutationActions)\.[A-Za-z0-9_]+)\s*\(/g;
    const violations: string[] = [];

    for (const filePath of walkTypeScriptFiles(sourceRoot)) {
      const relativePath = relative(sourceRoot, filePath).replaceAll('\\', '/');
      if (relativePath.includes('/__tests__/')) continue;

      const source = readFileSync(filePath, 'utf8');
      for (const match of source.matchAll(actionAwaitPattern)) {
        const actionName = match[1];
        if (!allowedAwaitedActions.has(actionName)) {
          violations.push(`${relativePath}: ${actionName}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

function walkTypeScriptFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root)) {
    const entryPath = join(root, entry);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      if (entry === '__tests__') continue;
      files.push(...walkTypeScriptFiles(entryPath));
      continue;
    }

    if (entryPath.endsWith('.ts') || entryPath.endsWith('.tsx')) {
      files.push(entryPath);
    }
  }

  return files;
}

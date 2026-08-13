import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  isRetryableServerMutationError,
  serverConfirmed,
  trackServerFinalization,
  waitForClientApply,
  type MutationResultLike,
} from '../mutate-with-server-check';

vi.setConfig({ testTimeout: 20_000 });

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

  it('identifies only transient database concurrency failures as retryable', () => {
    expect(isRetryableServerMutationError(new Error('deadlock detected'))).toBe(true);
    expect(
      isRetryableServerMutationError('could not serialize access due to concurrent update')
    ).toBe(true);
    expect(isRetryableServerMutationError(new Error('Permission denied'))).toBe(false);
  });

  it('keeps production serverConfirmed call sites limited to server-gated flows', () => {
    const repoRoot = process.cwd();
    const sourceRoot = join(repoRoot, 'src');
    const allowedFiles = new Set([
      'features/agendas/hooks/useAgendaNavigation.ts',
      'features/amendments/city-design/hooks/useCityDesignPageController.ts',
      'features/amendments/ui/useAmendmentProcessFlowController.ts',
      'features/decision-terminal/hooks/useDecisionVoteDialogController.ts',
      'features/editor/hooks/useEditorOperations.ts',
      'features/events/hooks/useEventMutations.ts',
      'features/notifications/hooks/useNotificationActions.ts',
      'features/todos/hooks/useTodoMutations.ts',
      'features/vote-cast/hooks/useVotePasswordConfirmation.ts',
      'features/vote-cast/ui/VoteCastDialog.tsx',
      'features/votes/hooks/useEventVoting.ts',
      'zero/accreditation/useAccreditationActions.ts',
      'zero/users/useUserActions.ts',
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

  it('does not directly await locally aliased Zero action hook functions', () => {
    const repoRoot = process.cwd();
    const sourceRoot = join(repoRoot, 'src');
    const violations: string[] = [];

    for (const filePath of walkTypeScriptFiles(sourceRoot)) {
      const relativePath = relative(sourceRoot, filePath).replaceAll('\\', '/');
      if (relativePath.includes('/__tests__/')) continue;

      const source = readFileSync(filePath, 'utf8');
      for (const actionName of collectKnownActionHookAliases(source)) {
        const directAwaitPattern = new RegExp(`\\bawait\\s+${escapeRegExp(actionName)}\\s*\\(`);
        if (directAwaitPattern.test(source)) {
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

function collectKnownActionHookAliases(source: string): string[] {
  const hookPattern =
    /\bconst\s*\{([\s\S]*?)\}\s*=\s*(useVoteActions|useElectionActions|useWorkflowActions|useGroupConnectionActions)\s*\(/g;
  const aliases: string[] = [];

  for (const match of source.matchAll(hookPattern)) {
    const bindings = match[1]
      .split(',')
      .map(binding => binding.trim())
      .filter(Boolean);

    for (const binding of bindings) {
      const cleaned = binding.replace(/\s*=.*$/, '').trim();
      const localName = cleaned.includes(':')
        ? cleaned.split(':').at(-1)?.trim()
        : cleaned.split(/\s+/)[0]?.trim();

      if (localName && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(localName)) {
        aliases.push(localName);
      }
    }
  }

  return aliases;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

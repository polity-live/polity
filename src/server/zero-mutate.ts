import type { ZeroContext } from '@/zero/context';
import { dbProvider } from '@/zero/db-provider';

export type ZeroTransaction = Parameters<Parameters<typeof dbProvider.transaction>[0]>[0];

interface ZeroMutatorRequest<TArgs> {
  readonly mutator: {
    readonly fn: (options: { tx: ZeroTransaction; ctx: ZeroContext; args: TArgs }) => Promise<void>;
  };
  readonly args: TArgs;
}

export function createZeroContext(userID: string, email = ''): ZeroContext {
  return { userID, email };
}

export async function executeZeroTransaction<TResult>(
  ctx: ZeroContext,
  callback: (tx: ZeroTransaction, ctx: ZeroContext) => Promise<TResult>
): Promise<TResult> {
  return dbProvider.transaction(async tx => callback(tx, ctx));
}

export async function executeZeroRead<TResult>(
  callback: (tx: ZeroTransaction) => Promise<TResult>
): Promise<TResult> {
  return dbProvider.transaction(async tx => callback(tx));
}

export async function runZeroMutator<TArgs>(
  tx: ZeroTransaction,
  request: ZeroMutatorRequest<TArgs>,
  ctx: ZeroContext
): Promise<void> {
  await request.mutator.fn({ tx, ctx, args: request.args });
}

export async function executeZeroMutator<TArgs>(
  request: ZeroMutatorRequest<TArgs>,
  ctx: ZeroContext
): Promise<void> {
  await executeZeroTransaction(ctx, async tx => {
    await runZeroMutator(tx, request, ctx);
  });
}

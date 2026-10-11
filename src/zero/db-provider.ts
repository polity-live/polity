import { zeroPostgresJS } from '@rocicorp/zero/server/adapters/postgresjs';
import { schema } from './schema';
import { getRequiredEnvVar } from '@/lib/env';
import { withAfterCommit } from '@/server/after-commit';
import {
  diagnoseMutationTransaction,
  mutationDiagnostic,
  mutationTransactionIdentity,
  withMutationTransactionIdentity,
} from '@/server/zero-mutation-diagnostics';

const connectionString = getRequiredEnvVar(process.env.ZERO_UPSTREAM_DB, 'ZERO_UPSTREAM_DB');

export const dbProvider = zeroPostgresJS(schema, connectionString);
const transactionWithoutDiagnostics = dbProvider.transaction.bind(dbProvider);
dbProvider.transaction = (callback, identity) =>
  withMutationTransactionIdentity(identity, () =>
    transactionWithoutDiagnostics(callback, identity)
  );

// Lock before permission reads, not only before the eventual SQL UPDATE. Every
// application entry point (Zero pushes, AI commands and Studio mutators)
// uses this provider, serializing permission checks with membership changes.
const transactionWithoutAuthorityLock = dbProvider.connection.transaction.bind(
  dbProvider.connection
);
dbProvider.connection.transaction = callback =>
  withAfterCommit(() =>
    diagnoseMutationTransaction(
      () =>
        transactionWithoutAuthorityLock(async tx => {
          const lockAt = performance.now();
          await tx.query('select pg_advisory_xact_lock($1)', [1886351981]);
          mutationDiagnostic('authority-lock', lockAt, mutationTransactionIdentity());
          const result = await callback(tx);
          return result;
        }),
      mutationTransactionIdentity()
    )
  );

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    dbProvider: typeof dbProvider;
  }
}

import { zeroPostgresJS } from '@rocicorp/zero/server/adapters/postgresjs';
import { schema } from './schema';
import { getRequiredEnvVar } from '@/lib/env';
import { withAfterCommit } from '@/server/after-commit';

const connectionString = getRequiredEnvVar(process.env.ZERO_UPSTREAM_DB, 'ZERO_UPSTREAM_DB');

export const dbProvider = zeroPostgresJS(schema, connectionString);

// Lock before permission reads, not only before the eventual SQL UPDATE. Every
// application entry point (Zero pushes, AI commands and Studio mutators)
// uses this provider, serializing permission checks with membership changes.
const transactionWithoutAuthorityLock = dbProvider.connection.transaction.bind(
  dbProvider.connection
);
dbProvider.connection.transaction = callback =>
  withAfterCommit(() =>
    transactionWithoutAuthorityLock(async tx => {
      await tx.query('select pg_advisory_xact_lock($1)', [1886351981]);
      const result = await callback(tx);
      return result;
    })
  );

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    dbProvider: typeof dbProvider;
  }
}

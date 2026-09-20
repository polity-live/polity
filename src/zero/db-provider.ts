import { zeroPostgresJS } from '@rocicorp/zero/server/adapters/postgresjs';
import { schema } from './schema';
import { getRequiredEnvVar } from '@/lib/env';

const connectionString = getRequiredEnvVar(process.env.ZERO_UPSTREAM_DB, 'ZERO_UPSTREAM_DB');

export const dbProvider = zeroPostgresJS(schema, connectionString);

// Lock before permission reads, not only before the eventual SQL UPDATE. Every
// entry point (Zero pushes, AI commands and HTTP collaboration commands) uses
// this provider. Database policy triggers acquire the same lock.
const transactionWithoutAuthorityLock = dbProvider.connection.transaction.bind(
  dbProvider.connection
);
dbProvider.connection.transaction = callback =>
  transactionWithoutAuthorityLock(async tx => {
    await tx.query('select pg_advisory_xact_lock($1)', [1886351981]);
    const result = await callback(tx);
    const { initializeTransactionDocuments } = await import('@/server/collaboration/finalize');
    await initializeTransactionDocuments(tx);
    return result;
  });

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    dbProvider: typeof dbProvider;
  }
}

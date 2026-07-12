import { zeroPostgresJS } from '@rocicorp/zero/server/adapters/postgresjs';
import { schema } from './schema';
import { getRequiredEnvVar } from '@/lib/env';

const connectionString = getRequiredEnvVar(process.env.ZERO_UPSTREAM_DB, 'ZERO_UPSTREAM_DB');

export const dbProvider = zeroPostgresJS(schema, connectionString);

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    dbProvider: typeof dbProvider;
  }
}

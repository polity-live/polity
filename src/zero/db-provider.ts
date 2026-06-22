import postgres from 'postgres';
import { zeroPostgresJS } from '@rocicorp/zero/server/adapters/postgresjs';
import { schema } from './schema';
import { getRequiredEnvVar } from '@/lib/env';

const sql = postgres(getRequiredEnvVar(process.env.ZERO_UPSTREAM_DB, 'ZERO_UPSTREAM_DB'));

export const dbProvider = zeroPostgresJS(schema, sql);

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    dbProvider: typeof dbProvider;
  }
}

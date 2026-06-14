import postgres from 'postgres';

const zeroUpstreamDb = process.env.ZERO_UPSTREAM_DB;

if (!zeroUpstreamDb) {
  throw new Error('Missing ZERO_UPSTREAM_DB');
}

export const eurostatSql = postgres(zeroUpstreamDb, {
  max: 2,
  idle_timeout: 20,
});

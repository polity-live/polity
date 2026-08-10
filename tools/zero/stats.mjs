import postgres from 'postgres';

import { runCliIfMain } from '../shared/run-cli-if-main.mjs';

const DEFAULT_STATZ_URL = 'http://127.0.0.1:4848/statz';

export function extractJSON(source, label) {
  const labelIndex = source.indexOf(`${label}:`);
  if (labelIndex < 0) return undefined;

  const start = source.indexOf('[', labelIndex + label.length + 1);
  if (start < 0) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === '[') depth += 1;
    else if (character === ']') {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(start, index + 1));
    }
  }

  return undefined;
}

export function scalarCount(source, label) {
  return Number(extractJSON(source, label)?.[0]?.c ?? 0);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function readProfileStats(options = {}) {
  const env = options.env ?? process.env;
  const connectionString = env.ZERO_CVR_DB ?? env.ZERO_UPSTREAM_DB;
  if (!connectionString) return undefined;

  const appID = env.ZERO_APP_ID ?? 'zero';
  const shard = env.ZERO_SHARD_NUM ?? '0';
  const schema = `${appID}_${shard}/cvr`;
  const createClient = options.postgresFactory ?? postgres;
  const logger = options.logger ?? console;
  const sql = createClient(connectionString, {
    max: 1,
    connect_timeout: 3,
    idle_timeout: 1,
  });

  try {
    const [row] = await sql`
      SELECT
        count(*) FILTER (WHERE NOT "deleted")::integer AS groups,
        count(DISTINCT "profileID") FILTER (WHERE NOT "deleted")::integer AS profiles
      FROM ${sql(schema)}.instances
    `;
    return row;
  } catch (error) {
    logger.warn(`Profilstatistik nicht verfügbar: ${errorMessage(error)}`);
    return undefined;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export async function collectZeroStats(options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const statzURL = env.ZERO_STATZ_URL ?? DEFAULT_STATZ_URL;
  const response = await fetchImpl(statzURL, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const source = await response.text();
  const groupRows = extractJSON(source, 'totalActiveQueriesPerClientAndClientGroup') ?? [];
  const profileStats = await readProfileStats({
    env,
    postgresFactory: options.postgresFactory,
    logger: options.logger,
  });

  return {
    activeQueries: scalarCount(source, 'numActiveQueries'),
    uniqueQueryHashes: scalarCount(source, 'numUniqueQueryHashes'),
    queryGroups: groupRows.length,
    clients: groupRows.reduce((sum, row) => sum + Number(row.num_clients ?? 0), 0),
    activeCVRGroups: profileStats?.groups ?? 'n/a',
    profiles: profileStats?.profiles ?? 'n/a',
  };
}

export async function runZeroStatsCli(options = {}) {
  const logger = options.logger ?? console;
  const processState = options.processState ?? process;
  const collect = options.collect ?? collectZeroStats;
  try {
    const stats = await collect(options);
    logger.table([stats]);
    return stats;
  } catch (error) {
    logger.error(`Zero-Statistik konnte nicht geladen werden: ${errorMessage(error)}`);
    processState.exitCode = 1;
    return undefined;
  }
}

await runCliIfMain(import.meta.url, runZeroStatsCli);

import postgres from 'postgres';

const statzURL = process.env.ZERO_STATZ_URL ?? 'http://127.0.0.1:4848/statz';

function extractJSON(source, label) {
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

function scalarCount(source, label) {
  return Number(extractJSON(source, label)?.[0]?.c ?? 0);
}

async function readProfileStats() {
  const connectionString = process.env.ZERO_CVR_DB ?? process.env.ZERO_UPSTREAM_DB;
  if (!connectionString) return undefined;

  const appID = process.env.ZERO_APP_ID ?? 'zero';
  const shard = process.env.ZERO_SHARD_NUM ?? '0';
  const schema = `${appID}_${shard}/cvr`;
  const sql = postgres(connectionString, {
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
    console.warn(`Profilstatistik nicht verfügbar: ${error.message}`);
    return undefined;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

try {
  const response = await fetch(statzURL, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const source = await response.text();
  const groupRows = extractJSON(source, 'totalActiveQueriesPerClientAndClientGroup') ?? [];
  const profileStats = await readProfileStats();

  console.table([
    {
      activeQueries: scalarCount(source, 'numActiveQueries'),
      uniqueQueryHashes: scalarCount(source, 'numUniqueQueryHashes'),
      queryGroups: groupRows.length,
      clients: groupRows.reduce((sum, row) => sum + Number(row.num_clients ?? 0), 0),
      activeCVRGroups: profileStats?.groups ?? 'n/a',
      profiles: profileStats?.profiles ?? 'n/a',
    },
  ]);
} catch (error) {
  console.error(`Zero-Statistik konnte nicht geladen werden: ${error.message}`);
  process.exitCode = 1;
}

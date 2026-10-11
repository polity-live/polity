/** Local-only live acceptance. Session files are private, ignored artifacts; logs contain no credentials. */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { loadEnv } from 'vite';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import {
  createStudioDocumentV5,
  createFrameNode,
} from '../../src/features/communication-studio/logic/document-v3';
import {
  getDatasetTopicQueries,
  interpretDatasetSearch,
} from '../../src/features/charts/logic/datasetSearch';

const origin = 'http://localhost:3000';
const directory = 'output/dataset-repair';
Object.assign(process.env, loadEnv('development', process.cwd(), ''));
const genesisToken = process.env.GENESIS_API_TOKEN;
assert(genesisToken, 'A configured GENESIS token is required');
const local = JSON.parse(
  execFileSync(
    process.execPath,
    ['node_modules/supabase/dist/supabase.js', 'status', '--output', 'json'],
    { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  )
);
for (const url of [local.API_URL, local.DB_URL, origin])
  assert(
    ['localhost', '127.0.0.1'].includes(new URL(url).hostname),
    'Only the local stack is permitted'
  );
await mkdir(directory, { recursive: true });
const sql = postgres(local.DB_URL, { max: 1 });

try {
  if (process.argv.includes('--fixture')) {
    const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const email = `dataset-repair-${crypto.randomUUID()}@example.test`;
    const password = crypto.randomUUID() + 'Aa1!';
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    const actor = created.data.user.id;
    const projectId = crypto.randomUUID();
    const document = createStudioDocumentV5('Dataset repair acceptance', 'single');
    document.nodes = [createFrameNode('widescreen')];
    await sql`insert into "user" (id) values (${actor}) on conflict do nothing`;
    await sql`insert into studio_project (id, owner_id, title, kind, document_schema_version, created_at, updated_at) values (${projectId}, ${actor}, ${document.title}, ${document.kind}, 6, ${Date.now()}, ${Date.now()})`;
    await sql`insert into studio_state (project_id, document, updated_at) values (${projectId}, ${sql.json(JSON.parse(JSON.stringify(document)))}, ${Date.now()})`;
    const cookies: { name: string; value: string }[] = [];
    const client = createServerClient(local.API_URL, local.ANON_KEY, {
      cookies: {
        getAll: () => [],
        setAll: items => {
          cookies.push(...items);
        },
      },
    });
    const session = await client.auth.signInWithPassword({ email, password });
    if (session.error) throw session.error;
    await writeFile(
      `${directory}/fixture-private.json`,
      JSON.stringify({ actor, projectId, accessToken: session.data.session.access_token })
    );
    await writeFile(
      `${directory}/browser-state.json`,
      JSON.stringify({
        cookies: cookies.map(cookie => ({
          ...cookie,
          domain: 'localhost',
          path: '/',
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
          expires: -1,
        })),
        origins: [],
      })
    );
    console.log(JSON.stringify({ fixture: 'ready', url: `${origin}/studio/${projectId}` }));
  } else if (process.argv.includes('--studio-check')) {
    const fixture = JSON.parse(await readFile(`${directory}/fixture-private.json`, 'utf8'));
    const [row] =
      await sql`select document from studio_state where project_id = ${fixture.projectId}`;
    const charts = row.document.nodes.filter((node: any) => node.type === 'chart');
    assert(charts.length > 0, 'The inserted chart must persist after closing the dialog');
    console.log(
      JSON.stringify({
        charts: charts.length,
        nodes: row.document.nodes.length,
        saved: true,
        chartProperties: Object.keys(charts[0]).filter(
          key => !['id', 'parentFrameId', 'name'].includes(key)
        ),
      })
    );
  } else if (process.argv.includes('--unemployment')) {
    for (const limit of [20, 10, 50]) {
      const term = 'unemployment';
      const start = Date.now();
      try {
        const response = await fetch('https://genesis.destatis.de/genesisWS/rest/2020/find/find', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            username: genesisToken,
          },
          body: new URLSearchParams({
            term,
            category: 'tables',
            language: 'en',
            pagelength: String(limit),
          }),
          signal: AbortSignal.timeout(15000),
        });
        const body = await response.json();
        console.log(
          JSON.stringify({
            term,
            limit,
            language: 'en',
            http: response.status,
            tables: body.Tables?.length ?? 0,
            durationMs: Date.now() - start,
          })
        );
      } catch (error) {
        console.log(
          JSON.stringify({
            term,
            error: error instanceof Error ? error.name : 'unknown',
            durationMs: Date.now() - start,
          })
        );
      }
    }
  } else if (process.argv.includes('--latency')) {
    for (const limit of [50, 20, 10]) {
      const start = Date.now();
      const response = await fetch('https://genesis.destatis.de/genesisWS/rest/2020/find/find', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          username: genesisToken,
        },
        body: new URLSearchParams({
          term: 'Bruttoinlandsprodukt',
          category: 'tables',
          language: 'de',
          pagelength: String(limit),
        }),
        signal: AbortSignal.timeout(15000),
      });
      let body: any;
      try {
        body = await response.json();
      } catch {
        /* upstream non-JSON */
      }
      console.log(
        JSON.stringify({
          endpoint: 'find/find',
          term: 'Bruttoinlandsprodukt',
          limit,
          status: response.status,
          durationMs: Date.now() - start,
          tables: body?.Tables?.length ?? 0,
        })
      );
    }
  } else if (process.argv.includes('--diagnose')) {
    const queries = getDatasetTopicQueries(interpretDatasetSearch('Arbeitslose 2025 Deutschland'));
    const check = async (term: string, corrected: boolean) => {
      const start = Date.now();
      try {
        const headers: Record<string, string> = {
          'Content-Type': corrected
            ? 'application/x-www-form-urlencoded; charset=UTF-8'
            : 'application/x-www-form-urlencoded',
          username: genesisToken,
        };
        if (!corrected) headers.password = '';
        const response = await fetch('https://genesis.destatis.de/genesisWS/rest/2020/find/find', {
          method: 'POST',
          headers,
          body: new URLSearchParams({
            term,
            category: corrected ? 'tables' : 'all',
            language: 'de',
            pagelength: '50',
          }),
          signal: AbortSignal.timeout(8000),
        });
        let body: any;
        try {
          body = await response.json();
        } catch {
          /* non-JSON upstream error */
        }
        return {
          endpoint: 'find/find',
          category: corrected ? 'tables' : 'all',
          language: 'de',
          pagelength: 50,
          term,
          corrected,
          http: response.status,
          providerCode: body?.Status?.Code,
          tables: body?.Tables?.length ?? 0,
          durationMs: Date.now() - start,
        };
      } catch (error) {
        return {
          term,
          corrected,
          error: error instanceof Error ? error.name : 'unknown',
          durationMs: Date.now() - start,
        };
      }
    };
    const legacy = await Promise.all(queries.map(query => check(query, false)));
    const corrected = [];
    for (const query of queries) corrected.push(await check(query, true));
    const legacySerial = [];
    const compare = process.argv.includes('--compare');
    if (compare) for (const query of queries) legacySerial.push(await check(query, false));
    const correctedParallel = compare
      ? await Promise.all(queries.map(query => check(query, true)))
      : undefined;
    const report = {
      legacyParallel: legacy,
      correctedSerial: corrected,
      ...(compare ? { legacySerial, correctedParallel } : {}),
    };
    await writeFile(
      `${directory}/genesis-diagnostics${compare ? '-comparison' : ''}.json`,
      JSON.stringify(report, null, 2)
    );
    console.log(JSON.stringify(report));
  } else {
    const fixture = JSON.parse(await readFile(`${directory}/fixture-private.json`, 'utf8'));
    const report: object[] = [];
    const language = process.argv.includes('--english') ? 'en' : 'de';
    const call = async (path: string, body?: object) => {
      const response = await fetch(origin + path, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${fixture.accessToken}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(120000),
      });
      const value = await response.json();
      if (!response.ok)
        throw new Error(`${path}: HTTP ${response.status}, ${value.error?.code ?? 'unknown'}`);
      return value;
    };
    for (const provider of ['GENESIS_DESTATIS', 'EUROSTAT'])
      for (const topic of ['Arbeitslose', 'Bevölkerung', 'Bruttoinlandsprodukt', 'Inflation']) {
        const query = `${topic} 2025 Deutschland`;
        const start = Date.now();
        const params = new URLSearchParams({
          q: query,
          lang: language,
          providers: provider,
          withStatus: 'true',
        });
        const result = await call(`/api/datasets/search?${params}`);
        const item = {
          provider,
          language,
          query,
          results: result.results.length,
          matches: result.results.filter((row: any) => row.searchMatch?.group === 'matching')
            .length,
          errors: result.errors.map((error: any) => error.code),
          durationMs: Date.now() - start,
        };
        report.push(item);
        console.log(JSON.stringify(item));
      }
    if (!process.argv.includes('--search-only'))
      for (const request of [
        {
          provider: 'GENESIS_DESTATIS',
          code: '12411-0001',
          language: 'de',
          filters: { area: 'Deutschland', period: { start: 2024, end: 2025 } },
        },
        {
          provider: 'EUROSTAT',
          code: 'UNE_RT_A',
          language: 'de',
          filters: {
            area: 'Deutschland',
            period: { start: 2025, end: 2025 },
            dimensions: { freq: 'A', age: 'Y15-74', sex: 'T', unit: 'THS_PER' },
          },
        },
      ]) {
        const prepared = await call('/api/datasets/prepare', request);
        const snapshot = await call('/api/datasets/snapshots', request);
        assert(snapshot.rowCount > 0);
        const measure = snapshot.columnProfiles.find((profile: any) => profile.role === 'measure');
        const time = snapshot.columnProfiles.find((profile: any) => profile.role === 'time');
        const projected = await call(`/api/datasets/${snapshot.snapshotId}/projection`, {
          view: 'chart',
          aggregation: 'sum',
          measureColumn: measure.name,
          dimensionColumn: time.name,
          filters: {},
          timeRange: { column: time.name, startYear: 2025, endYear: 2025 },
        });
        assert(projected.points.length > 0);
        assert(projected.points.every((point: any) => point.x.includes('2025')));
        const details = await call(`/api/datasets/${snapshot.datasetId}/details`);
        assert.equal(details.providerResourceId, snapshot.providerResourceId);
        const item = {
          provider: request.provider,
          code: request.code,
          preparation: prepared.dimensions.length,
          rows: snapshot.rowCount,
          points: projected.points,
          scoped: snapshot.providerResourceId?.startsWith('scope:'),
          restored: details.snapshots.some((row: any) => row.id === snapshot.snapshotId),
        };
        report.push(item);
        console.log(JSON.stringify(item));
      }
    await writeFile(
      `${directory}/live-acceptance-${language}.json`,
      JSON.stringify(report, null, 2)
    );
  }
} finally {
  await sql.end();
}

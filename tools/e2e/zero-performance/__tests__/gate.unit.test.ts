import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  BUDGETS,
  REPETITIONS,
  checkBudgets,
  compare,
  comparisonEligible,
  confirmedRegressions,
  percentile,
  median,
  type Measurement,
} from '../metrics';
import { discoverQueries, loadCases, buildQuery } from '../catalog';
import { rootSQL, resultIDs, relatedResultIDs, queryAST } from '../oracle';
import {
  assertOutputDirectory,
  isolatedPorts,
  safeEnvironment,
  isolatedBuildEnvironment,
  verifyBuildAssets,
} from '../isolation.mjs';
import {
  reportFailures,
  correlateQueryAPI,
  serverWarningFailures,
  securityCoverageFailures,
  REPORT_FORMAT,
  MEASUREMENT_PROTOCOL,
} from '../report';
import { stopOwnedRuntime, dependencyVersions } from '../linux-runtime.mjs';
import {
  applyElectionQueryAccess,
  applyElectionQueryAccessFromAuthorizedAgendaItem,
} from '../../../../src/zero/rbac/query-access';
import { zql } from '../../../../src/zero/schema';
import { conversationAccessFilter } from '../../../../src/zero/messages/queries';
import { securityScenarios, securityCaseManifest, SECURITY_SCENARIO_COUNT } from '../security';
import {
  applyAgendaItemQueryAccess,
  applyVoteQueryAccess,
  applyVoteQueryAccessFromAuthorizedAgendaItem,
  applyRoleQueryAccess,
  applyBlogQueryAccess,
  applyGroupQueryAccess,
  applyChangeRequestVisibilityAccess,
} from '../../../../src/zero/rbac/query-access';
import {
  queryObservationFailures,
  retainViewClientSamples,
  preloadRuns,
  viewRuns,
  type QueryObservation,
} from '../journey-metrics';

function measurement(overrides: Partial<Measurement> = {}): Measurement {
  return {
    key: 'users.byId/default/minimal/owner',
    name: 'users.byId',
    variant: 'default',
    profile: 'minimal',
    actor: 'owner',
    revision: 1,
    reason: 'Initial',
    args: { id: 'fixture' },
    expectedIDs: ['fixture'],
    observedIDs: Array.from({ length: REPETITIONS.materialize }, () => ['fixture']),
    samples: Array.from({ length: REPETITIONS.materialize }, (_, index) => ({
      queryID: 'query',
      activatedAt: 1000 + index * 100,
      authoritativeAt: 1100 + index * 100,
      api: {
        requestID: `request-${index}`,
        authMs: 10,
        transformMs: 1,
        requestMs: 20,
        arrivalAt: 1001 + index * 100,
        responseAt: 1021 + index * 100,
        responseToAuthoritativeMs: 79,
        structure: { bytes: 100, queries: 1, conditions: 1, maxQueryDepth: 1 },
      },
      totalMs: 100,
      clientMs: 5,
      serverMs: 10,
      clientGroupID: `group-${index}`,
      clientID: `client-${index}`,
      connectionMs: 20,
    })),
    analyzeMs: Array.from({ length: REPETITIONS.analyze }, () => 10),
    readRows: 2,
    scannedRows: 2,
    syncedRows: 1,
    plans: {
      sqlite: {},
      joins: [],
      scansByQuery: {},
      readsByQuery: {},
      exportMs: 1,
      exportMode: 'separate',
    },
    warnings: [],
    failures: [],
    ...overrides,
  };
}

describe('Zero performance gate', () => {
  it('correlates repeated query IDs with their actual activation interval and refuses ambiguity', () => {
    const item = measurement();
    const records = item.samples.flatMap((sample, index) => [
      { requestID: `request-${index}`, phase: 'arrival', at: 1001 + index * 100 },
      { requestID: `request-${index}`, phase: 'auth', elapsed: 10 },
      { requestID: `request-${index}`, phase: 'transform', name: item.name, elapsed: 1 },
      {
        requestID: `request-${index}`,
        phase: 'query-identities',
        at: 1020 + index * 100,
        queries: [{ id: 'query', name: item.name, structure: sample.api!.structure }],
      },
      { requestID: `request-${index}`, phase: 'response', at: 1021 + index * 100, elapsed: 20 },
    ]);
    correlateQueryAPI([item], records);
    expect(item.samples.map(sample => sample.api?.requestID)).toEqual(
      Array.from({ length: 5 }, (_, index) => `request-${index}`)
    );
    expect(checkBudgets(item)).toEqual([]);
    correlateQueryAPI([item], [...records, records[3]]);
    expect(item.samples[0].api).toBeUndefined();
    expect(checkBudgets(item)).toContain(
      'Missing or invalid correlated Auth/API/transform timings'
    );
    const valid = measurement();
    valid.samples[0].api!.structure = {} as never;
    expect(checkBudgets(valid)).toContain(
      'Missing or invalid correlated Auth/API/transform timings'
    );
  });
  it('short-circuits anonymous event management while retaining authenticated manager rules', () => {
    const entry = loadCases().find(
      entry => entry.name === 'events.delegateAssemblyComposition' && entry.variant === 'default'
    )!;
    const anonymous = queryAST(buildQuery(entry, { userID: 'anon', email: '' }));
    expect(anonymous.where).toEqual({ type: 'or', conditions: [] });
    const owner = queryAST(buildQuery(entry, { userID: 'owner', email: '' }));
    expect(owner.where?.type).toBe('and');
    expect(owner.where.conditions[0].left.name).toBe('id');
    expect(owner.where.conditions[1].conditions[0].left.name).toBe('creator_id');
  });
  it('counts every business permission scenario, including nested elections and votes', async () => {
    const cases: string[] = [];
    const sql = async () => [];
    await securityScenarios(sql as any, async (name, variant, _args, actor) => {
      cases.push(`${name}/${variant}/${actor}`);
    });
    expect(cases).toHaveLength(SECURITY_SCENARIO_COUNT);
    expect(new Set(cases).size).toBe(cases.length);
    expect(cases).toContain('events.byIdFull/vote-voter-revoked-owner/owner');
    expect(cases).toContain('events.forCancel/election-elector-revoked-owner/owner');
  });
  it('requires the public election to be present in every nested private-role security case', async () => {
    const cases = await securityCaseManifest();
    const roles = cases.filter(item => item.key.includes('/security-election-role-'));
    expect(roles).toHaveLength(84);
    for (const item of roles) {
      expect(item.expectedIDs).toHaveLength(1);
      const relations = item.related!.relations;
      const rolePath = Object.keys(relations).find(
        path => path === 'role' || path.endsWith('.role')
      )!;
      expect(rolePath).toBeTruthy();
      if (rolePath !== 'role') expect(relations[rolePath.slice(0, -5)]).toHaveLength(1);
      expect(relations[rolePath]).toHaveLength(
        item.key.includes('-holder-') || item.key.includes('-public-') ? 1 : 0
      );
    }
  });
  it('checks all election role projections independently without removing their role relation', () => {
    for (const userID of ['owner', 'outsider', 'anon']) {
      for (const name of [
        'events.forCancel',
        'events.streamEvent',
        'events.agendaWithElections',
        'events.agendaItemsFull',
        'events.agendaItemDetail',
        'events.wikiAgendaItems',
        'events.electionWithVotes',
        'elections.byAgendaItem',
        'elections.byId',
        'elections.decisionOverviewPage',
        'elections.decisionPage',
        'elections.electionsWithDetails',
        'elections.electionsForSearch',
        'elections.pendingElections',
      ]) {
        const entry = loadCases().find(
          entry => entry.name === name && entry.variant === 'default'
        )!;
        const ast = queryAST(buildQuery(entry, { userID, email: '' }));
        const roles: any[] = [];
        const visit = (query: any) => {
          for (const relation of query.related ?? []) {
            if (query.table === 'election' && relation.subquery.table === 'role')
              roles.push(relation.subquery);
            visit(relation.subquery);
          }
        };
        visit(ast);
        expect(roles, name).toHaveLength(1);
        const withoutHints = (value: any): any =>
          Array.isArray(value)
            ? value.map(withoutHints)
            : value && typeof value === 'object'
              ? Object.fromEntries(
                  Object.entries(value)
                    .filter(([key]) => key !== 'flip')
                    .map(([key, item]) => [key, withoutHints(item)])
                )
              : value;
        expect(withoutHints(roles[0].where), name).toEqual(
          withoutHints(queryAST(applyRoleQueryAccess(zql.role, userID)).where)
        );
      }
    }
  });
  it('validates a baseline against its own security manifest and rejects missing or altered expectations', () => {
    const item = measurement({
      key: 'groups.byId/security-private-owner/security/outsider',
      profile: 'security',
      expectedIDs: ['group'],
    });
    const report = {
      measurements: [item],
      expectedSecurityCases: [{ key: item.key, expectedIDs: ['group'] }],
    };
    expect(securityCoverageFailures(report)).toEqual([]);
    expect(securityCoverageFailures({ ...report, measurements: [] })).toContain(
      'Missing fixed security scenarios'
    );
    expect(
      securityCoverageFailures({
        ...report,
        expectedSecurityCases: [{ key: item.key, expectedIDs: [] }],
      })
    ).toContain('Missing fixed security scenarios');
    expect(
      securityCoverageFailures({
        ...report,
        expectedSecurityCases: [...report.expectedSecurityCases, ...report.expectedSecurityCases],
      })
    ).toContain('Missing fixed security scenarios');
  });
  it('protects event children with their independent agenda, election and vote rules', () => {
    for (const userID of ['owner', 'outsider', 'anon']) {
      for (const name of [
        'events.byIdFull',
        'events.forCancel',
        'events.streamEvent',
        'events.withVoting',
      ]) {
        const entry = loadCases().find(
          entry => entry.name === name && entry.variant === 'default'
        )!;
        const event = queryAST(buildQuery(entry, { userID, email: '' }));
        const agenda = event.related?.find(
          ({ subquery }) => subquery.table === 'agenda_item'
        )?.subquery;
        expect(agenda?.where).toEqual(
          queryAST(applyAgendaItemQueryAccess(zql.agenda_item, userID)).where
        );
        const election = agenda?.related?.find(
          ({ subquery }) => subquery.table === 'election'
        )?.subquery;
        if (name !== 'events.withVoting')
          expect(election?.where).toEqual(
            queryAST(applyElectionQueryAccessFromAuthorizedAgendaItem(zql.election, userID)).where
          );
        if (name !== 'events.forCancel') {
          const vote = agenda?.related?.find(({ subquery }) => subquery.table === 'vote')?.subquery;
          expect(vote?.where).toEqual(
            queryAST(applyVoteQueryAccessFromAuthorizedAgendaItem(zql.vote, userID)).where
          );
        }
      }
      for (const name of [
        'events.agendaWithElections',
        'events.agendaItemsFull',
        'events.agendaItemDetail',
        'events.wikiAgendaItems',
      ]) {
        const entry = loadCases().find(
          entry => entry.name === name && entry.variant === 'default'
        )!;
        const agenda = queryAST(buildQuery(entry, { userID, email: '' }));
        expect(agenda.where).toBeDefined();
        const election = agenda.related?.find(
          ({ subquery }) => subquery.table === 'election'
        )?.subquery;
        expect(election?.where).toEqual(
          queryAST(applyElectionQueryAccessFromAuthorizedAgendaItem(zql.election, userID)).where
        );
        if (name === 'events.agendaItemsFull' || name === 'events.agendaItemDetail') {
          const vote = agenda.related?.find(({ subquery }) => subquery.table === 'vote')?.subquery;
          expect(vote?.where).toEqual(
            queryAST(applyVoteQueryAccessFromAuthorizedAgendaItem(zql.vote, userID)).where
          );
        }
      }
    }
  });
  it('detects transitive dependency changes even when Zero itself is identical', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'zero-performance-deps-'));
    const relative = path.relative(path.resolve(tmpdir()), path.resolve(directory));
    if (!relative.startsWith('zero-performance-deps-') || relative.includes(path.sep))
      throw new Error('Unsafe test fixture cleanup target');
    const root = path.join(directory, 'zero');
    const hidden = path.join(directory, 'node_modules', 'hidden');
    const cycle = path.join(directory, 'node_modules', 'cycle');
    const manifest = (target: string, pkg: unknown) => {
      mkdirSync(target, { recursive: true });
      writeFileSync(path.join(target, 'package.json'), JSON.stringify(pkg));
    };
    try {
      manifest(root, {
        name: '@rocicorp/zero',
        version: '1.9.0',
        dependencies: { hidden: '1', fs: '*' },
        optionalDependencies: { platformBinary: '1' },
      });
      manifest(hidden, {
        name: 'hidden',
        version: '1.0.0',
        exports: { import: './esm.mjs' },
        dependencies: { cycle: '1' },
      });
      manifest(cycle, { name: 'cycle', version: '1.0.0', dependencies: { hidden: '1' } });
      expect(dependencyVersions(root)).toEqual([
        '@rocicorp/zero@1.9.0',
        'cycle@1.0.0',
        'hidden@1.0.0',
      ]);
      manifest(cycle, { name: 'cycle', version: '1.1.0', dependencies: { hidden: '1' } });
      expect(dependencyVersions(root)).toEqual([
        '@rocicorp/zero@1.9.0',
        'cycle@1.1.0',
        'hidden@1.0.0',
      ]);
      manifest(cycle, { name: 'cycle', version: '1.1.0', dependencies: { absent: '1' } });
      expect(() => dependencyVersions(root)).toThrow('Missing runtime dependency metadata: absent');
    } finally {
      rmSync(directory, { recursive: true });
    }
  });
  it('retains the complete independent election visibility predicate within an authorized agenda', () => {
    for (const userID of ['owner', 'outsider', 'anon']) {
      const full = queryAST(applyElectionQueryAccess(zql.election, userID));
      const nested = queryAST(
        applyElectionQueryAccessFromAuthorizedAgendaItem(zql.election, userID)
      );
      expect(full.where?.type).toBe('and');
      expect(full.where.conditions).toHaveLength(2);
      expect(nested.where).toEqual(full.where.conditions[1]);
      expect(nested.table).toEqual(full.table);
      // The omitted scope is an OR containing the already-authorized agenda,
      // not the independent visibility/elector/private-parent predicate.
      expect(full.where.conditions[0].conditions[0].related.subquery.table).toBe('agenda_item');
    }
  });
  it('retains the complete independent vote visibility predicate within an authorized agenda', () => {
    for (const userID of ['owner', 'outsider', 'anon', undefined]) {
      const full = queryAST(applyVoteQueryAccess(zql.vote, userID));
      const nested = queryAST(applyVoteQueryAccessFromAuthorizedAgendaItem(zql.vote, userID));
      expect(full.where?.type).toBe('and');
      expect(full.where.conditions).toHaveLength(2);
      expect(nested.where).toEqual(full.where.conditions[1]);
      expect(full.where.conditions[0].conditions[0].related.subquery.table).toBe('agenda_item');
    }
  });
  it('preserves every election access predicate when allowing automatic join planning', () => {
    const stripHints = (value: any): any =>
      Array.isArray(value)
        ? value.map(stripHints)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value)
                .filter(([key]) => key !== 'flip')
                .map(([key, child]) => [key, stripHints(child)])
            )
          : value;
    for (const userID of ['owner', 'outsider', 'anon']) {
      const query = zql.election.where('agenda_item_id', 'agenda');
      expect(stripHints(queryAST(applyElectionQueryAccess(query, userID, true)))).toEqual(
        stripHints(queryAST(applyElectionQueryAccess(query, userID)))
      );
    }
  });
  it('keeps all conversation access rules when planning the unread projection per conversation', () => {
    const withoutHints = (value: any): any =>
      Array.isArray(value)
        ? value.map(withoutHints)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value)
                .filter(([key]) => key !== 'flip')
                .map(([key, child]) => [key, withoutHints(child)])
            )
          : value;
    for (const userID of ['owner', 'outsider', 'anon', undefined]) {
      expect(
        withoutHints(queryAST(conversationAccessFilter(zql.conversation, userID, true)))
      ).toEqual(withoutHints(queryAST(conversationAccessFilter(zql.conversation, userID))));
    }
  });
  it('preserves group, blog and change-request access predicates when planning selected related rows', () => {
    const withoutHints = (value: any): any =>
      Array.isArray(value)
        ? value.map(withoutHints)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value)
                .filter(([key]) => key !== 'flip')
                .map(([key, item]) => [key, withoutHints(item)])
            )
          : value;
    for (const userID of ['owner', 'outsider', 'anon', undefined]) {
      for (const [table, access] of [
        [zql.group, applyGroupQueryAccess],
        [zql.blog, applyBlogQueryAccess],
        [zql.change_request, applyChangeRequestVisibilityAccess],
      ] as const)
        expect(withoutHints(queryAST(access(table as any, userID, true)))).toEqual(
          withoutHints(queryAST(access(table as any, userID)))
        );
    }
  });
  it('preserves private role rights when planning a selected role per row', () => {
    const withoutHints = (value: any): any =>
      Array.isArray(value)
        ? value.map(withoutHints)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value)
                .filter(([key]) => key !== 'flip')
                .map(([key, child]) => [key, withoutHints(child)])
            )
          : value;
    for (const userID of ['owner', 'outsider', 'anon', undefined]) {
      const role = zql.role.where('id', 'selected-role');
      expect(withoutHints(queryAST(applyRoleQueryAccess(role, userID, true)))).toEqual(
        withoutHints(queryAST(applyRoleQueryAccess(role, userID)))
      );
    }
  });
  it('rejects absent plans and invalid separate diagnostic timings without trusting failures', () => {
    expect(checkBudgets(measurement({ plans: {} }))).toContain('Missing query plans');
    expect(
      checkBudgets(
        measurement({
          plans: {
            sqlite: {},
            joins: [],
            scansByQuery: {},
            readsByQuery: {},
            exportMs: -1,
            exportMode: 'separate',
          },
        })
      )
    ).toContain('Missing separate query plan export timing');
    expect(checkBudgets(measurement())).toEqual([]);
  });
  it.each(['runtime', 'app'])(
    'only stops a %s carrying the exact isolated project ownership label',
    kind => {
      const project = 'polity-zero-performance-1234abcd';
      const container = `polity-zero-performance-${kind}-1234abcd`;
      const operations: string[][] = [];
      let label = 'another-project';
      let present = true;
      const execute = (_command: string, args: string[]) => {
        operations.push(args);
        return {
          status: 0,
          stdout:
            args[0] === 'ps'
              ? present
                ? container
                : ''
              : args[0] === 'inspect'
                ? JSON.stringify({ 'polity.zero-performance.project': label })
                : '',
        };
      };
      expect(() => stopOwnedRuntime(project, container, execute)).toThrow(
        'ownership label mismatch'
      );
      expect(operations.some(args => args[0] === 'stop')).toBe(false);
      label = project;
      stopOwnedRuntime(project, container, execute);
      expect(operations.at(-1)).toEqual(['stop', '--time', '10', container]);
      operations.length = 0;
      present = false;
      stopOwnedRuntime(project, container, execute);
      expect(operations.map(args => args[0])).toEqual(['ps']);
      operations.length = 0;
      expect(() => stopOwnedRuntime(project, 'supabase-development', execute)).toThrow(
        'runtime identity'
      );
      expect(operations).toEqual([]);
    }
  );
  it('keeps a group access predicate on every registered nested group projection', () => {
    const missing: string[] = [];
    for (const entry of loadCases()) {
      const visit = (ast: any, path: string) => {
        for (const related of ast.related ?? []) {
          const child = related.subquery;
          if (child.table === 'group' && !child.where) missing.push(`${path}.${child.alias}`);
          visit(child, `${path}.${child.alias}`);
        }
      };
      visit(queryAST(buildQuery(entry)), `${entry.name}/${entry.variant}`);
    }
    expect(missing).toEqual([]);
  });
  it('rejects a server manifest whose browser assets belong to a different build', async () => {
    const request = async (address: unknown, options?: { method?: string }) =>
      options?.method === 'HEAD'
        ? new Response('', { status: String(address).includes('missing') ? 404 : 200 })
        : new Response(
            '<script src="/assets/missing.js"></script><link rel="stylesheet" href="/assets/app.css">'
          );
    await expect(verifyBuildAssets('http://127.0.0.1:55620', request)).rejects.toThrow(
      'missing asset'
    );
    await expect(
      verifyBuildAssets(
        'http://127.0.0.1:55620',
        async () =>
          new Response(
            '<script src="/assets/entry.js"></script><link rel="stylesheet" href="/assets/app.css">'
          )
      )
    ).resolves.toBe(2);
  });
  it('rejects a production document with a missing or unresolved stylesheet', async () => {
    for (const link of ['', '<link rel="stylesheet">', '<link rel="stylesheet" href="">']) {
      await expect(
        verifyBuildAssets(
          'http://127.0.0.1:55620',
          async () => new Response(`<script src="/assets/entry.js"></script>${link}`)
        )
      ).rejects.toThrow('valid application stylesheet');
    }
  });
  it('correlates repeated preloads by activation and measures cached authoritative views', () => {
    const event = { clientID: 'client', key: 'query', ttl: '10m' };
    const runs = preloadRuns([
      { ...event, activationID: 'first', phase: 'preload-start', at: 1 },
      { ...event, activationID: 'first', phase: 'preload-release', at: 2 },
      { ...event, activationID: 'second', phase: 'preload-start', at: 3 },
      { ...event, activationID: 'first', phase: 'preload-complete', at: 4 },
      { ...event, activationID: 'second', phase: 'preload-complete', at: 5 },
    ]);
    expect(runs.map(run => run.authoritativeAt)).toEqual([4, 5]);
    const views = viewRuns([
      {
        activationID: 'view',
        activatedAt: 10,
        readAt: 10,
        at: 12,
        phase: 'commit',
        type: 'complete',
        ids: ['allowed'],
        name: 'groups.byId',
        args: { id: 'allowed' },
      },
    ]);
    const query: QueryObservation = {
      id: 'hash',
      clientID: 'client',
      name: 'groups.byId',
      args: [{}],
      kind: 'materialized',
      got: true,
      client: 2,
      server: null,
      total: null,
      ttl: '10m',
      inactive: null,
      preloads: [],
      views,
    };
    expect(queryObservationFailures(retainViewClientSamples(query, 13, new Map()))).toEqual([]);
    expect(queryObservationFailures({ ...query, client: null })).toContain(
      'Missing materialization metrics'
    );
    expect(
      queryObservationFailures({
        ...query,
        views: views.map(view => ({ ...view, authoritativeAt: null })),
      })
    ).toContain('Missing authoritative view completion');
    expect(
      queryObservationFailures({
        ...query,
        views: views.map(view => ({ ...view, authoritativeAt: 1011 })),
      })
    ).toContain('Total exceeds 1000 ms');
  });
  it('keeps Vite and Nitro build artifacts private when dependencies are shared', () => {
    const first = isolatedBuildEnvironment('/benchmark/first/project');
    const second = isolatedBuildEnvironment('/benchmark/second/project');
    for (const key of ['POLITY_VITE_CACHE_DIR', 'POLITY_NITRO_BUILD_DIR'] as const) {
      expect(first[key]).not.toEqual(second[key]);
      expect(first[key]).toContain('first');
      expect(second[key]).toContain('second');
      expect(first[key]).not.toContain('node_modules');
    }
  });
  it('rejects truncated full reports, omitted security checks, browser journeys and duplicate results', async () => {
    const item = measurement();
    const failures = await reportFailures({
      format: REPORT_FORMAT,
      protocol: MEASUREMENT_PROTOCOL,
      filtered: false,
      layer: 'all',
      expectedKeys: [item.key, 'missing/case'],
      infrastructure: [],
      measurements: [item, item],
    });
    expect(failures).toContain('Duplicate measurement keys');
    expect(failures).toContain('Missing measurement missing/case');
    expect(failures).toContain('Missing fixed security scenarios');
    expect(failures).toContain('Missing first browser journeys');
    expect(failures).toContain('Missing subscribed revoke-membership check');
  });
  it('validates raw server warnings independently of prepared failure lists', async () => {
    const report = {
      format: REPORT_FORMAT,
      protocol: MEASUREMENT_PROTOCOL,
      filtered: false,
      layer: 'all',
      expectedKeys: [],
      infrastructure: [],
      measurements: [],
      serverWarnings: ['Slow query materialization 110'],
    };
    expect(await reportFailures(report)).toContain('1 server slow-query warnings');
    expect(serverWarningFailures(report, false)).toEqual([]);
    expect(serverWarningFailures({ ...report, serverWarnings: [] })).toEqual([]);
    expect(serverWarningFailures({ ...report, serverWarnings: undefined })).toContain(
      'Missing or invalid server slow-query observations'
    );
    expect(
      serverWarningFailures({ ...report, serverWarnings: ['unrelated warning'] }, false)
    ).toContain('Missing or invalid server slow-query observations');
  });
  it('requires preload completion without inventing a local materialization', () => {
    const query: QueryObservation = {
      id: 'hash',
      clientID: 'client',
      name: 'groups.byId',
      args: [{}],
      kind: 'preload',
      got: true,
      client: null,
      server: 2,
      total: null,
      ttl: '10m',
      inactive: null,
      preloads: preloadRuns([
        {
          activationID: 'run',
          clientID: 'client',
          key: 'query',
          phase: 'preload-start',
          at: 5,
          ttl: '10m',
        },
        {
          activationID: 'run',
          clientID: 'client',
          key: 'query',
          phase: 'preload-complete',
          at: 105,
          ttl: '10m',
        },
      ]),
    };
    expect(queryObservationFailures(query)).toEqual([]);
    expect(queryObservationFailures({ ...query, preloads: [] })).toContain(
      'Missing preload observations'
    );
    expect(queryObservationFailures({ ...query, kind: 'materialized' })).toContain(
      'Missing materialization metrics'
    );
    const slow = {
      ...query,
      preloads: [
        {
          activationID: 'run',
          activatedAt: 0,
          authoritativeAt: 1001,
          releasedAt: null,
          error: false,
        },
      ],
    };
    expect(queryObservationFailures(slow)).toContain('Preload exceeds 1000 ms');
    expect(queryObservationFailures(slow, false)).toEqual([]);
    expect(
      queryObservationFailures(
        {
          ...query,
          preloads: [
            {
              activationID: 'run',
              activatedAt: 0,
              authoritativeAt: null,
              releasedAt: 1,
              error: false,
            },
          ],
        },
        false
      )
    ).toContain('Missing or failed preload completion');
  });
  it('retains measured local timings across release without borrowing another view or hiding a violation', () => {
    const samples = new Map();
    const query: QueryObservation = {
      id: 'query',
      clientID: 'client',
      name: 'users.current',
      args: [{}],
      kind: 'materialized',
      got: true,
      client: 7,
      server: 2,
      total: 20,
      ttl: '10m',
      inactive: null,
      preloads: [],
      views: [{ activationID: 'view', activatedAt: 0, authoritativeAt: 10, releasedAt: null }],
    };
    expect(queryObservationFailures(retainViewClientSamples(query, 20, samples))).toEqual([]);
    const released = {
      ...query,
      client: null,
      total: null,
      views: [{ ...query.views![0], releasedAt: 30 }],
    };
    expect(queryObservationFailures(retainViewClientSamples(released, 40, samples))).toEqual([]);
    for (const changed of [
      { ...released, clientID: 'another-client' },
      { ...released, views: [{ ...released.views[0], activationID: 'another-view' }] },
    ])
      expect(queryObservationFailures(retainViewClientSamples(changed, 40, samples))).toContain(
        'Missing materialization metrics'
      );
    retainViewClientSamples({ ...query, client: 51 }, 21, samples);
    expect(queryObservationFailures(retainViewClientSamples(query, 22, samples))).toContain(
      'Client exceeds 50 ms'
    );
    expect(queryObservationFailures(retainViewClientSamples(released, 40, samples))).toContain(
      'Client exceeds 50 ms'
    );
  });
  it('revalidates browser budgets even if its recorded failures are empty', async () => {
    const query: QueryObservation = {
      id: 'hash',
      clientID: 'client',
      name: 'groups.byId',
      args: [{}],
      kind: 'materialized',
      got: true,
      client: 51,
      server: 2,
      total: 1001,
      ttl: '10m',
      inactive: null,
      preloads: [],
    };
    const report = {
      format: REPORT_FORMAT,
      protocol: MEASUREMENT_PROTOCOL,
      filtered: false,
      layer: 'all',
      expectedKeys: ['missing'],
      infrastructure: [],
      measurements: [],
      journeys: [
        {
          route: '/group',
          visit: 'repeat',
          visibleMs: 1001,
          cachedDisplayMs: 51,
          queries: [query],
          failures: [],
        },
      ],
    };
    expect(
      (await reportFailures(report)).some(failure => failure.includes('Client exceeds 50 ms'))
    ).toBe(true);
    expect(
      (await reportFailures(report)).some(failure =>
        failure.includes('Cached display exceeds 50 ms')
      )
    ).toBe(true);
    expect((await reportFailures(report, false)).some(failure => failure.includes('exceeds'))).toBe(
      false
    );
  });
  it('rejects independent nested-result mismatches', () => {
    const check = {
      rootID: 'connection',
      expected: { group_b: [] },
      observed: Array.from({ length: 5 }, () => ({ group_b: ['private'] })),
    };
    expect(checkBudgets(measurement({ relatedChecks: check }))).toContain(
      'Missing or incorrect independent related-result checks'
    );
  });
  it('separates internal Zero ports from Supabase and excludes inherited production credentials', () => {
    const ports = isolatedPorts(55620);
    expect(new Set(Object.values(ports)).size).toBe(7);
    expect(ports.api).toBeGreaterThan(ports.zeroReplication);
    expect(
      safeEnvironment({
        PATH: 'tools',
        ZERO_UPSTREAM_DB: 'production',
        SUPABASE_URL: 'https://production',
        VITE_APP_URL: 'https://production',
        HOME: 'runtime',
      })
    ).toEqual({ PATH: 'tools', HOME: 'runtime' });
    expect(() => assertOutputDirectory(process.cwd(), process.cwd())).toThrow();
    expect(() =>
      assertOutputDirectory(process.cwd(), 'output/zero-performance/../outside')
    ).toThrow();
    expect(() =>
      assertOutputDirectory(process.cwd(), 'output/zero-performance/new-run')
    ).not.toThrow();
  });
  it('rejects missing, nonfinite and negative measurements instead of treating them as fast', () => {
    for (const value of [[], [NaN], [Infinity], [-1]])
      expect(() => percentile(value, 0.95)).toThrow();
    expect(checkBudgets(measurement({ samples: [] }))).not.toEqual([]);
    expect(checkBudgets(measurement({ readRows: NaN }))).toContain('Missing readRows');
    expect(
      checkBudgets(
        measurement({ plans: { scansByQuery: { statement: { index: 2, subquery: -1 } } } })
      )
    ).toContain('Analyzer returned unavailable or invalid scan counts');
    expect(median([10, 30, 20, 40])).toBe(25);
    expect(comparisonEligible(measurement({ readRows: NaN }))).toBe(false);
    expect(comparisonEligible(measurement({ analyzeMs: Array(20).fill(110) }))).toBe(true);
  });
  it('rejects reused client groups and positive cases with missing or incorrect results', () => {
    const reused = measurement();
    reused.samples[1].clientGroupID = reused.samples[0].clientGroupID;
    expect(checkBudgets(reused).join(' ')).toContain('distinct fresh client groups');
    const wrong = measurement({ observedIDs: Array.from({ length: 5 }, () => []) });
    expect(checkBudgets(wrong)).toContain('Missing or incorrect authoritative result checks');
    expect(checkBudgets(measurement({ observedIDs: [] }))).toContain(
      'Missing or incorrect authoritative result checks'
    );
    expect(checkBudgets(measurement({ plans: null }))).toContain('Missing query plans');
  });
  it('enforces single-run total/client maxima and the server p95', () => {
    expect(checkBudgets(measurement())).toEqual([]);
    expect(
      checkBudgets(
        measurement({
          samples: [
            {
              totalMs: BUDGETS.totalMs + 1,
              clientMs: 0,
              serverMs: 0,
              clientGroupID: 'fresh',
              clientID: 'client',
              connectionMs: 1,
            },
          ],
        })
      )
    ).toContain('Total exceeds 1000 ms');
    expect(
      checkBudgets(measurement({ analyzeMs: [1, ...Array.from({ length: 19 }, () => 101)] }))
    ).toContain('Server p95 exceeds 100 ms');
    expect(checkBudgets(measurement({ warnings: ['Slow query materialization'] }))).toContain(
      '1 slow-query warnings'
    );
  });
  it('requires both relative and absolute timing deltas and a second confirmation', () => {
    const base = measurement();
    const small = measurement({ analyzeMs: Array(20).fill(15) });
    expect(compare([base], [small])).toEqual([]);
    const head = measurement({ analyzeMs: Array(20).fill(25) });
    const first = compare([base], [head]);
    expect(first).toHaveLength(1);
    expect(confirmedRegressions(first, [])).toEqual([]);
    expect(confirmedRegressions(first, compare([base], [head]))).toEqual(first);
  });
  it('requires a higher revision and a changed explanation for additional row work without exempting time budgets', () => {
    const base = measurement();
    expect(compare([base], [measurement({ readRows: 3 })])[0].kind).toBe('work');
    expect(
      compare([base], [measurement({ revision: 2, reason: 'Returns a new relation', readRows: 3 })])
    ).toEqual([]);
    expect(
      compare(
        [base],
        [
          measurement({
            revision: 2,
            reason: 'Returns a new relation',
            analyzeMs: Array(20).fill(25),
          }),
        ]
      )[0].kind
    ).toBe('timing');
  });
  it('discovers the whole registry and rejects added or removed queries without catalog reconciliation', () => {
    const registry = discoverQueries();
    const cases = loadCases();
    expect(new Set(cases.map(c => c.name)).size).toBe(registry.size);
    expect(registry.has('projectChat.conversations')).toBe(true);
    expect(registry.has('studio.sessionProject')).toBe(true);
    const extended = new Map(registry);
    extended.set('new.query', registry.values().next().value!);
    expect(() => loadCases(extended)).toThrow('Missing: new.query');
    const removed = new Map(registry);
    removed.delete('users.byId');
    expect(() => loadCases(removed)).toThrow('stale: users.byId');
  });
  it('uses parametrized root-result SQL, handles empty IN and rejects unsupported AST shapes', () => {
    const columns = new Map([
      ['user', new Map([['created_at', { type: 'timestamp with time zone' }]])],
    ]);
    const value = "'; drop table public.user; --";
    const query = rootSQL(
      {
        table: 'user',
        where: {
          type: 'simple',
          left: { type: 'column', name: 'handle' },
          right: { type: 'literal', value },
          op: '=',
        },
      },
      columns
    );
    expect(query.text).not.toContain(value);
    expect(query.values).toEqual([value]);
    expect(query.text).toContain('ORDER BY t0."id" asc');
    expect(
      rootSQL({ table: 'user', orderBy: [['first_name', 'desc']], limit: 2 }, columns).text
    ).toContain('ORDER BY t0."first_name" desc NULLS LAST, t0."id" asc NULLS FIRST LIMIT');
    expect(
      rootSQL(
        {
          table: 'user',
          where: {
            type: 'simple',
            left: { type: 'column', name: 'id' },
            right: { type: 'literal', value: [] },
            op: 'IN',
          },
        },
        columns
      ).text
    ).toContain('FALSE');
    expect(() => rootSQL({ table: 'user', where: { type: 'unknown' } }, columns)).toThrow();
    expect(resultIDs(undefined)).toEqual([]);
    expect(resultIDs([{ id: 'one' }])).toEqual(['one']);
    expect(() => resultIDs([{ secret: 'unexpected' }])).toThrow();
    expect(
      relatedResultIDs(
        { connections: [{ group: null }, { group: { id: 'allowed' } }] },
        'connections.group'
      )
    ).toEqual(['allowed']);
    expect(() =>
      relatedResultIDs({ connections: [{ group: { secret: 'private' } }] }, 'connections.group')
    ).toThrow();
  });
});

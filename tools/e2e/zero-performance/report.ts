import { BUDGETS, checkBudgets, type Measurement } from './metrics';
import { queryObservationFailures, type QueryObservation } from './journey-metrics';
import { securityCaseManifest, type SecurityCaseExpectation } from './security';
import { loadCases } from './catalog';
import type { NavigationTarget } from './browser-navigation';

export const REPORT_FORMAT = 7;
export const MEASUREMENT_PROTOCOL = 'zero-performance/v7';

export function correlateQueryAPI(measurements: Measurement[], records: any[]) {
  const byRequest = new Map<string, any[]>();
  const byQuery = new Map<string, any[]>();
  for (const record of records) {
    if (!record || typeof record.requestID !== 'string') continue;
    const group = byRequest.get(record.requestID) ?? [];
    group.push(record);
    byRequest.set(record.requestID, group);
    if (record.phase === 'query-identities' && Array.isArray(record.queries)) {
      for (const query of record.queries) {
        if (!query || typeof query.id !== 'string' || typeof query.name !== 'string') continue;
        const key = JSON.stringify([query.name, query.id]);
        const identities = byQuery.get(key) ?? [];
        identities.push(record);
        byQuery.set(key, identities);
      }
    }
  }
  for (const measurement of measurements)
    for (const sample of measurement.samples) {
      delete sample.api;
      const identities = (
        byQuery.get(JSON.stringify([measurement.name, sample.queryID])) ?? []
      ).filter(
        record =>
          record.phase === 'query-identities' &&
          record.at >= (sample.activatedAt ?? NaN) &&
          record.at <= (sample.authoritativeAt ?? NaN) &&
          record.queries?.some(
            (query: any) => query.id === sample.queryID && query.name === measurement.name
          )
      );
      if (identities.length !== 1) continue;
      const identity = identities[0];
      const group = byRequest.get(identity.requestID) ?? [];
      const one = (phase: string) => {
        const matches = group.filter(record => record.phase === phase);
        return matches.length === 1 ? matches[0] : undefined;
      };
      const query = identity.queries.find((query: any) => query.id === sample.queryID);
      const queriesWithName = identity.queries.filter(
        (query: any) => query.name === measurement.name
      );
      const transforms = group.filter(
        record => record.phase === 'transform' && record.name === measurement.name
      );
      const transform =
        transforms[queriesWithName.findIndex((query: any) => query.id === sample.queryID)];
      const arrival = one('arrival'),
        response = one('response'),
        auth = one('auth');
      if (
        !arrival ||
        !response ||
        !auth ||
        !transform ||
        transforms.length !== queriesWithName.length
      )
        continue;
      sample.api = {
        requestID: identity.requestID,
        authMs: auth.elapsed,
        transformMs: transform.elapsed,
        requestMs: response.elapsed,
        arrivalAt: arrival.at,
        responseAt: response.at,
        responseToAuthoritativeMs: (sample.authoritativeAt ?? NaN) - response.at,
        structure: query.structure,
      };
    }
}
export function isAbsoluteBudgetFailure(failure: string) {
  return /^(Total exceeds \d+ ms|Client exceeds \d+ ms|Server p95 exceeds \d+ ms|\d+ slow-query warnings|\d+ server slow-query warnings)$/.test(
    failure
  );
}

export interface Report {
  format: number;
  protocol?: string;
  filtered: boolean;
  layer: string;
  expectedKeys: string[];
  expectedSecurityCases?: SecurityCaseExpectation[];
  infrastructure: string[];
  measurements: Measurement[];
  serverWarnings?: string[];
  apiDiagnostics?: any[];
  journeys?: {
    route: string;
    visit: string;
    visibleMs: number;
    authoritativeMs?: number;
    queries: QueryObservation[];
    cachedDisplayMs?: number;
    failures: string[];
    target?: NavigationTarget;
    processing?: { navigationStart: number };
  }[];
}

function routeQuery(route: string) {
  if (route === '/search') return { name: 'search.searchDocumentPage' };
  if (route === '/messages') return { name: 'messages.messagePage' };
  const agenda = route.match(/^\/event\/([^/]+)\/agenda\/?$/);
  if (agenda) return { name: 'events.agendaItemsFull', args: { eventId: agenda[1] } };
  const entity = route.match(/^\/(group|event|amendment)\/([^/]+)\/?$/);
  if (!entity) return;
  return {
    name: {
      group: 'groups.wikiOverview',
      event: 'events.wikiData',
      amendment: 'amendments.byIdWiki',
    }[entity[1]],
    args: { id: entity[2] },
  };
}

/** A visible virtualized route must have a real committed result view, not only a preload. */
export function navigationMaterializationFailures(
  journey: NonNullable<Report['journeys']>[number]
) {
  const expected = routeQuery(journey.route);
  const start = journey.processing?.navigationStart;
  if (
    !expected ||
    !journey.target ||
    journey.target.path !== journey.route ||
    typeof start !== 'number' ||
    !Number.isFinite(start) ||
    start < 0
  )
    return [`Missing navigation target/activation: ${journey.route}/${journey.visit}`];
  const args = { ...expected.args, ...journey.target.queryArgs };
  const found = journey.queries.some(query => {
    const actual = (query.args as any[])?.[0];
    return (
      query.name === expected.name &&
      query.kind === 'materialized' &&
      Object.entries(args).every(
        ([key, value]) => JSON.stringify(actual?.[key]) === JSON.stringify(value)
      ) &&
      query.views?.some(view => view.releasedAt === null || view.releasedAt > start)
    );
  });
  return found ? [] : [`Missing committed visible query: ${journey.route}/${journey.visit}`];
}

export function serverWarningFailures(report: Report, absoluteBudgets = true): string[] {
  if (
    !Array.isArray(report.serverWarnings) ||
    report.serverWarnings.some(line => typeof line !== 'string' || !/Slow query/i.test(line))
  )
    return ['Missing or invalid server slow-query observations'];
  return absoluteBudgets && report.serverWarnings.length
    ? [`${report.serverWarnings.length} server slow-query warnings`]
    : [];
}

export async function reportFailures(report: Report, absoluteBudgets = true): Promise<string[]> {
  const failures: string[] = serverWarningFailures(report, absoluteBudgets);
  if (
    report.format !== REPORT_FORMAT ||
    report.protocol !== MEASUREMENT_PROTOCOL ||
    report.filtered ||
    report.layer !== 'all'
  )
    failures.push('A complete all-layer report is required');
  failures.push(
    ...report.infrastructure.filter(failure => absoluteBudgets || !isAbsoluteBudgetFailure(failure))
  );
  if (!report.expectedKeys?.length) failures.push('Missing expected query coverage');
  if (absoluteBudgets) {
    const currentKeys = loadCases().flatMap(entry =>
      ['empty/owner', 'minimal/owner', 'minimal/outsider', 'minimal/anonymous'].map(
        profile => `${entry.name}/${entry.variant}/${profile}`
      )
    );
    if (
      new Set(report.expectedKeys).size !== currentKeys.length ||
      currentKeys.some(key => !(report.expectedKeys ?? []).includes(key))
    )
      failures.push('Declared coverage does not match the complete current query registry');
  }
  const keys = report.measurements.map(item => item.key);
  if (!Array.isArray(report.apiDiagnostics)) failures.push('Missing correlated API diagnostics');
  else {
    const correlated = report.measurements.map(item => ({
      ...item,
      samples: item.samples.map(sample => ({ ...sample })),
    }));
    correlateQueryAPI(correlated, report.apiDiagnostics);
    for (let index = 0; index < correlated.length; index++) {
      if (
        correlated[index].samples.some(
          (sample, position) =>
            !sample.api ||
            JSON.stringify(sample.api) !==
              JSON.stringify(report.measurements[index].samples[position].api)
        )
      )
        failures.push(`${correlated[index].key}: API timings do not match raw request diagnostics`);
    }
  }
  if (new Set(keys).size !== keys.length) failures.push('Duplicate measurement keys');
  for (const key of report.expectedKeys ?? [])
    if (!keys.includes(key)) failures.push(`Missing measurement ${key}`);
  for (const item of report.measurements)
    failures.push(
      ...checkBudgets(item)
        .filter(failure => absoluteBudgets || !isAbsoluteBudgetFailure(failure))
        .map(failure => `${item.key}: ${failure}`)
    );
  failures.push(...securityCoverageFailures(report));
  if (
    absoluteBudgets &&
    JSON.stringify(report.expectedSecurityCases) !== JSON.stringify(await securityCaseManifest())
  )
    failures.push('Declared security coverage does not match the current business cases');
  for (const variant of [
    'private-related-group-owner',
    'private-related-group-anonymous',
    'authorized-related-private-group',
  ]) {
    const item = report.measurements.find(
      item => item.name === 'network.wikiNetwork' && item.variant === `security-${variant}`
    );
    if (!item?.relatedChecks) failures.push(`Missing independent nested security case ${variant}`);
  }
  const journeys = report.journeys ?? [];
  for (const name of ['events.byIdFull', 'events.forParticipation'])
    for (const actor of ['owner', 'anonymous', 'outsider'])
      if (
        !report.measurements.some(
          item =>
            item.name === name &&
            item.variant === `security-private-event-group-${actor}` &&
            item.relatedChecks
        )
      )
        failures.push(`Missing independent nested event-group security case ${name}/${actor}`);
  for (const variant of [
    'nested-network-owner',
    'nested-network-anonymous',
    'nested-network-outsider',
    'revoked-related-subscription',
    'authorized-related-subscription',
  ]) {
    if (
      !report.measurements.some(
        item => item.variant === `security-${variant}` && item.relatedChecks
      )
    )
      failures.push(`Missing independent nested security case ${variant}`);
  }
  for (const visit of ['first', 'back', 'repeat']) {
    const records = journeys.filter(journey => journey.visit === visit);
    if (
      records.length !== 6 ||
      new Set(records.map(journey => routeQuery(journey.route)?.name)).size !== 6 ||
      records.some(journey => !routeQuery(journey.route))
    )
      failures.push(`Missing ${visit} browser journeys`);
  }
  for (const visit of ['revoke-membership', 'data-update'])
    if (!journeys.some(journey => journey.visit === visit))
      failures.push(`Missing subscribed ${visit} check`);
  for (const journey of journeys) {
    if (journey.visit === 'warnings') {
      if (
        !journey.failures.length ||
        journey.failures.some(failure => !/Slow query/i.test(failure))
      )
        failures.push('Invalid browser warning record');
      else if (absoluteBudgets)
        failures.push(`${journey.failures.length} browser slow-query warnings`);
      continue;
    }
    if (!Number.isFinite(journey.visibleMs) || journey.visibleMs < 0 || !journey.queries.length)
      failures.push(`Missing navigation metrics ${journey.route}/${journey.visit}`);
    if (absoluteBudgets && journey.visibleMs > BUDGETS.totalMs)
      failures.push(
        `Visible content exceeds ${BUDGETS.totalMs} ms: ${journey.route}/${journey.visit}`
      );
    if (['first', 'back', 'repeat'].includes(journey.visit)) {
      failures.push(...navigationMaterializationFailures(journey));
      if (
        journey.authoritativeMs === undefined ||
        !Number.isFinite(journey.authoritativeMs) ||
        journey.authoritativeMs < 0
      )
        failures.push(
          `Missing authoritative content measurement: ${journey.route}/${journey.visit}`
        );
      else if (absoluteBudgets && journey.authoritativeMs > BUDGETS.totalMs)
        failures.push(
          `Authoritative content exceeds ${BUDGETS.totalMs} ms: ${journey.route}/${journey.visit}`
        );
    }
    if (['back', 'repeat'].includes(journey.visit)) {
      if (
        journey.cachedDisplayMs === undefined ||
        !Number.isFinite(journey.cachedDisplayMs) ||
        journey.cachedDisplayMs < 0
      )
        failures.push(`Missing cached display measurement: ${journey.route}/${journey.visit}`);
      else if (absoluteBudgets && journey.cachedDisplayMs > BUDGETS.clientMs)
        failures.push(
          `Cached display exceeds ${BUDGETS.clientMs} ms: ${journey.route}/${journey.visit}`
        );
    }
    for (const query of journey.queries)
      failures.push(
        ...queryObservationFailures(query, absoluteBudgets).map(
          failure => `${query.name}: ${failure}`
        )
      );
    failures.push(
      ...journey.failures.filter(
        failure =>
          absoluteBudgets ||
          !(
            /^(Visible content exceeds \d+ ms|Authoritative content exceeds \d+ ms|Cached display exceeds \d+ ms|Subscribed data update exceeds budget)$/.test(
              failure
            ) || /^Query .+: (Client|Total|Preload) exceeds \d+ ms$/.test(failure)
          )
      )
    );
  }
  return failures;
}

export function securityCoverageFailures(
  report: Pick<Report, 'expectedSecurityCases' | 'measurements'>
): string[] {
  const declared = report.expectedSecurityCases;
  const actual = report.measurements.filter(item => item.profile === 'security');
  if (
    !Array.isArray(declared) ||
    !declared.length ||
    new Set(declared.map(item => item.key)).size !== declared.length ||
    actual.length !== declared.length ||
    declared.some(expected => {
      const item = actual.find(item => item.key === expected.key);
      return (
        !item ||
        JSON.stringify(item.expectedIDs) !== JSON.stringify(expected.expectedIDs) ||
        JSON.stringify(
          item.relatedChecks && {
            rootID: item.relatedChecks.rootID,
            relations: item.relatedChecks.expected,
          }
        ) !== JSON.stringify(expected.related)
      );
    })
  )
    return ['Missing fixed security scenarios'];
  return [];
}

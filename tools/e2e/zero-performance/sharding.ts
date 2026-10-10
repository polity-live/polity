import { createHash } from 'node:crypto';
import type { SecurityCaseExpectation } from './security';

export const SHARD_FORMAT = 1;
export const ACTIVE_BUDGET_MS = { prepare: 180_000, runner: 900_000, merge: 120_000 };
export const PROFILE_KEYS = [
  'empty/owner',
  'minimal/owner',
  'minimal/outsider',
  'minimal/anonymous',
];
export interface Workload {
  queries: string[];
  security: SecurityCaseExpectation[];
}
export type Revision = 'head' | 'base';
export interface Shard {
  id: string;
  layer: 'queries' | 'security' | 'journeys' | 'diagnostics';
  head: string[];
  base: string[];
}
export interface Manifest {
  format: number;
  protocol: string;
  runID: string;
  headSHA: string;
  baseSHA?: string;
  harnessDigest: string;
  bootstrap?: string;
  workloads: { head: Workload; base?: Workload };
  shards: Shard[];
  digest: string;
}
export interface Execution {
  manifestDigest: string;
  shardID: string;
  revision: Revision;
  sourceSHA: string;
  harnessDigest: string;
  runnerID: string;
  phase: 'initial' | 'confirmation' | 'control';
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .filter(key => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export function digest(value: unknown) {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export function securityKey(name: string, variant: string, actor: string) {
  return `${name}/security-${variant}/security/${actor}`;
}
export function selectKeys<T extends { key: string }>(all: T[], selected?: string[]) {
  if (!selected) return all;
  if (
    !selected.length ||
    new Set(selected).size !== selected.length ||
    selected.some(key => !all.some(entry => entry.key === key))
  )
    throw new Error('Invalid security selection');
  const keys = new Set(selected);
  return all.filter(entry => keys.has(entry.key));
}
export function balancedGroups(
  groups: { key: string; members: string[]; weight: number }[],
  count: number
) {
  const bins = Array.from({ length: count }, () => ({ members: [] as string[], weight: 0 }));
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    groups.some(group => !Number.isFinite(group.weight) || group.weight <= 0)
  )
    throw new Error('Invalid shard weights or count');
  for (const group of [...groups].sort(
    (a, b) => b.weight - a.weight || a.key.localeCompare(b.key, 'en')
  )) {
    let target = 0;
    for (let index = 1; index < bins.length; index++)
      if (bins[index].weight < bins[target].weight) target = index;
    bins[target].members.push(...group.members);
    bins[target].weight += group.weight;
  }
  return bins.map(bin => bin.members.sort());
}
export function createManifest(
  input: Omit<Manifest, 'format' | 'shards' | 'digest'>,
  weights: Record<string, number>
): Manifest {
  const unknownWeight = (security: boolean) =>
    Math.max(
      1,
      ...Object.entries(weights)
        .filter(
          ([key, value]) =>
            key.split('/').length > 2 === security && Number.isFinite(value) && value > 0
        )
        .map(([, value]) => value)
    );
  const variantFallback = unknownWeight(false),
    securityFallback = unknownWeight(true);
  const weight = (key: string) =>
    Number.isFinite(weights[key]) && weights[key] > 0
      ? weights[key]
      : key.split('/').length > 2
        ? securityFallback
        : variantFallback;
  const queries = [
    ...new Set([...input.workloads.head.queries, ...(input.workloads.base?.queries ?? [])]),
  ];
  const names = [...new Set(queries.map(key => key.split('/')[0]))];
  const queryBins = balancedGroups(
    names.map(name => {
      const members = queries.filter(key => key.split('/')[0] === name);
      return { key: name, members, weight: members.reduce((total, key) => total + weight(key), 0) };
    }),
    16
  );
  const security = [
    ...new Set(
      [...input.workloads.head.security, ...(input.workloads.base?.security ?? [])].map(
        entry => entry.key
      )
    ),
  ];
  const securityBins = balancedGroups(
    security.map(key => ({ key, members: [key], weight: weight(key) })),
    2
  );
  const shard = (id: string, layer: Shard['layer'], members: string[]): Shard => ({
    id,
    layer,
    head: members.filter(key =>
      layer === 'queries'
        ? input.workloads.head.queries.includes(key)
        : input.workloads.head.security.some(entry => entry.key === key)
    ),
    base: members.filter(key =>
      layer === 'queries'
        ? input.workloads.base?.queries.includes(key)
        : input.workloads.base?.security.some(entry => entry.key === key)
    ),
  });
  const unsigned = {
    ...input,
    format: SHARD_FORMAT,
    shards: [
      ...queryBins.map((members, index) => shard(`queries-${index + 1}`, 'queries', members)),
      ...securityBins.map((members, index) => shard(`security-${index + 1}`, 'security', members)),
      { id: 'journeys', layer: 'journeys' as const, head: [], base: [] },
      { id: 'diagnostics', layer: 'diagnostics' as const, head: [], base: [] },
    ],
  };
  const result = { ...unsigned, digest: digest(unsigned) };
  validateManifest(result);
  return result;
}
export function coverageFailures(expected: string[], actual: string[]) {
  return [
    ...(new Set(actual).size !== actual.length ? ['Duplicate assignments or measurements'] : []),
    ...expected.filter(key => !actual.includes(key)).map(key => `Missing ${key}`),
    ...actual.filter(key => !expected.includes(key)).map(key => `Unexpected ${key}`),
  ];
}
export function validateManifest(manifest: Manifest) {
  const { digest: checksum, ...unsigned } = manifest;
  if (
    manifest.format !== SHARD_FORMAT ||
    manifest.protocol !== 'zero-performance/v10' ||
    typeof manifest.runID !== 'string' ||
    !manifest.runID.trim() ||
    checksum !== digest(unsigned) ||
    !/^[a-f0-9]{40}$/.test(manifest.headSHA) ||
    !/^[a-f0-9]{64}$/.test(manifest.harnessDigest) ||
    (manifest.baseSHA && !/^[a-f0-9]{40}$/.test(manifest.baseSHA))
  )
    throw new Error('Invalid or modified shard manifest');
  if (
    manifest.shards.length !== 20 ||
    new Set(manifest.shards.map(shard => shard.id)).size !== 20 ||
    manifest.shards.filter(shard => shard.layer === 'queries').length !== 16 ||
    manifest.shards.filter(shard => shard.layer === 'security').length !== 2 ||
    manifest.shards.filter(shard => shard.layer === 'journeys').length !== 1 ||
    manifest.shards.filter(shard => shard.layer === 'diagnostics').length !== 1
  )
    throw new Error('Incomplete shard matrix');
  if (Boolean(manifest.workloads.base) !== Boolean(manifest.baseSHA && !manifest.bootstrap))
    throw new Error('Invalid baseline/bootstrap declaration');
  if (!manifest.workloads.base && !manifest.bootstrap?.trim())
    throw new Error('Missing explicit baseline bootstrap');
  for (const layer of ['queries', 'security'] as const) {
    const assignments = new Map<string, string>();
    for (const shard of manifest.shards.filter(shard => shard.layer === layer)) {
      if (
        !new RegExp(`^${layer}-([1-9]|1[0-6])$`).test(shard.id) ||
        (layer === 'security' && !['security-1', 'security-2'].includes(shard.id))
      )
        throw new Error('Invalid shard identity');
      for (const key of [...shard.head, ...shard.base]) {
        const group = layer === 'queries' ? key.split('/')[0] : key;
        if (assignments.has(group) && assignments.get(group) !== shard.id)
          throw new Error('Split query grouping or baseline/head runner assignment');
        assignments.set(group, shard.id);
      }
    }
  }
  for (const shard of manifest.shards.filter(shard =>
    ['journeys', 'diagnostics'].includes(shard.layer)
  ))
    if (shard.id !== shard.layer || shard.head.length || shard.base.length)
      throw new Error('Invalid browser/diagnostic assignment');
  for (const revision of ['head', 'base'] as const) {
    const workload = manifest.workloads[revision];
    if (!workload) continue;
    for (const layer of ['queries', 'security'] as const) {
      const expected =
        layer === 'queries' ? workload.queries : workload.security.map(entry => entry.key);
      if (new Set(expected).size !== expected.length || (revision === 'head' && !expected.length))
        throw new Error('Invalid workload inventory');
      const failures = coverageFailures(
        expected,
        manifest.shards.filter(shard => shard.layer === layer).flatMap(shard => shard[revision])
      );
      if (failures.length)
        throw new Error(`Invalid ${revision} ${layer} coverage: ${failures.join('; ')}`);
    }
  }
}
export function executionFailures(
  execution: Execution | undefined,
  manifest: Manifest,
  shard: Shard,
  revision: Revision,
  phase: Execution['phase'],
  runnerID?: string
) {
  return !execution ||
    execution.manifestDigest !== manifest.digest ||
    execution.shardID !== shard.id ||
    execution.revision !== revision ||
    execution.sourceSHA !== (revision === 'head' ? manifest.headSHA : manifest.baseSHA) ||
    execution.harnessDigest !== manifest.harnessDigest ||
    execution.phase !== phase ||
    !execution.runnerID ||
    (runnerID && execution.runnerID !== runnerID)
    ? ['Missing or mismatched revision/runner/manifest identity']
    : [];
}

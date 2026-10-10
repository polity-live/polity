import { describe, expect, it } from 'vitest';
import {
  createManifest,
  validateManifest,
  digest,
  balancedGroups,
  coverageFailures,
  executionFailures,
  selectKeys,
  securityKey,
  type Workload,
} from '../sharding';
import { securityScenarios, securityCaseManifest } from '../security';

const workload = (): Workload => ({
  queries: Array.from({ length: 40 }, (_, index) => `q${index}/default`).concat(['q0/search']),
  security: Array.from({ length: 8 }, (_, index) => ({
    key: `q/security-${index}/security/owner`,
    expectedIDs: [String(index)],
  })),
});
const manifest = () =>
  createManifest(
    {
      protocol: 'zero-performance/v11',
      runID: 'run-1',
      headSHA: 'a'.repeat(40),
      baseSHA: 'b'.repeat(40),
      harnessDigest: 'c'.repeat(64),
      workloads: { head: workload(), base: workload() },
    },
    { 'q0/default': 100, 'q0/search': 50 }
  );

describe('distributed Zero workload planning', () => {
  it('preserves the manifest checksum through JSON transport with optional fields', () => {
    for (const hasBase of [true, false]) {
      const result = createManifest(
        {
          protocol: 'zero-performance/v11',
          runID: 'transport',
          headSHA: 'a'.repeat(40),
          baseSHA: hasBase ? 'b'.repeat(40) : undefined,
          harnessDigest: 'c'.repeat(64),
          bootstrap: hasBase ? undefined : 'Baseline predates benchmark',
          workloads: { head: workload(), base: hasBase ? workload() : undefined },
        },
        {}
      );
      expect(() => validateManifest(JSON.parse(JSON.stringify(result)))).not.toThrow();
    }
  });
  it('covers every query variant, keeps all variants of a query together, and covers security once', () => {
    const result = manifest();
    expect(result.shards).toHaveLength(20);
    expect(
      result.shards
        .filter(shard => shard.layer === 'queries')
        .flatMap(shard => shard.head)
        .sort()
    ).toEqual(workload().queries.sort());
    const q0 = result.shards.filter(shard => shard.head.includes('q0/default'));
    expect(q0).toHaveLength(1);
    expect(q0[0].head).toContain('q0/search');
    expect(
      result.shards
        .filter(shard => shard.layer === 'security')
        .flatMap(shard => shard.head)
        .sort()
    ).toEqual(
      workload()
        .security.map(entry => entry.key)
        .sort()
    );
  });
  it('balances longest groups first with deterministic tie-breaking and immutable input', () => {
    const groups = [
      { key: 'z', members: ['z'], weight: 10 },
      { key: 'a', members: ['a'], weight: 10 },
      { key: 'b', members: ['b'], weight: 5 },
    ];
    expect(balancedGroups(groups, 2)).toEqual([['a', 'b'], ['z']]);
    expect(groups[0].key).toBe('z');
    expect(balancedGroups([...groups].reverse(), 2)).toEqual(balancedGroups(groups, 2));
  });
  it('places unknown variants using the largest known weight', () => {
    const head = workload();
    head.queries.push('q0/backward');
    const result = createManifest(
      {
        protocol: 'zero-performance/v11',
        runID: 'run',
        headSHA: 'a'.repeat(40),
        harnessDigest: 'c'.repeat(64),
        bootstrap: 'No base',
        workloads: { head },
      },
      { 'q0/default': 1, 'q0/search': 1, 'q30/default': 100 }
    );
    expect(result.shards[0].head).toEqual(
      expect.arrayContaining(['q0/default', 'q0/search', 'q0/backward'])
    );
    expect(result.shards[1].head.length).toBeGreaterThan(0);
    expect(() => validateManifest(result)).not.toThrow();
  });
  it('assigns added and deleted variants to the same runner in both revisions', () => {
    const head = workload(),
      base = workload();
    head.queries.push('q0/next-page');
    base.queries.push('q0/backward');
    const result = createManifest(
      {
        protocol: 'zero-performance/v11',
        runID: 'run',
        headSHA: 'a'.repeat(40),
        baseSHA: 'b'.repeat(40),
        harnessDigest: 'c'.repeat(64),
        workloads: { head, base },
      },
      {}
    );
    const shard = result.shards.find(shard => shard.head.includes('q0/next-page'))!;
    expect(shard.base).toContain('q0/backward');
  });
  it('does not use security-case weights as the fallback for query variants', () => {
    const head = workload();
    head.queries.push('q0/backward');
    const result = createManifest(
      {
        protocol: 'zero-performance/v11',
        runID: 'run',
        headSHA: 'a'.repeat(40),
        harnessDigest: 'c'.repeat(64),
        bootstrap: 'No base',
        workloads: { head },
      },
      {
        'q0/default': 1,
        'q0/search': 1,
        'q30/default': 100,
        'q/security-expensive/security/owner': 100_000,
      }
    );
    expect(result.shards[0].head).toEqual(
      expect.arrayContaining(['q0/default', 'q0/search', 'q0/backward'])
    );
    expect(result.shards[0].head.length).toBeGreaterThan(3);
  });
  it('rejects edits to the manifest and independently rejects incomplete recomputed manifests', () => {
    const result = manifest();
    result.headSHA = 'd'.repeat(40);
    expect(() => validateManifest(result)).toThrow('modified');
    const incomplete = manifest();
    incomplete.shards[0].head.pop();
    const { digest: _checksum, ...unsigned } = incomplete;
    incomplete.digest = digest(unsigned);
    expect(() => validateManifest(incomplete)).toThrow('coverage');
  });
  it('rejects duplicate, missing and foreign measurements', () => {
    expect(coverageFailures(['a', 'b'], ['a', 'a', 'x'])).toEqual([
      'Duplicate assignments or measurements',
      'Missing b',
      'Unexpected x',
    ]);
  });
  it.each(['variant', 'revision'] as const)(
    'rejects recomputed manifests that split a %s across runners',
    kind => {
      const result = manifest();
      const source = result.shards.find(shard => shard.head.includes('q0/search'));
      const destination = result.shards.find(
        shard => shard.layer === 'queries' && shard !== source
      );
      if (!source || !destination) throw new Error('Missing test assignments');
      const revision = kind === 'variant' ? 'head' : 'base';
      source[revision] = source[revision].filter(key => key !== 'q0/search');
      destination[revision].push('q0/search');
      const { digest: _checksum, ...unsigned } = result;
      result.digest = digest(unsigned);
      expect(() => validateManifest(result)).toThrow('grouping');
    }
  );
  it.each(['sourceSHA', 'manifestDigest', 'harnessDigest', 'runnerID'] as const)(
    'rejects mismatched %s provenance',
    field => {
      const result = manifest(),
        shard = result.shards[0];
      const execution = {
        sourceSHA: result.headSHA,
        manifestDigest: result.digest,
        harnessDigest: result.harnessDigest,
        shardID: shard.id,
        revision: 'head' as const,
        phase: 'initial' as const,
        runnerID: 'runner-1',
      };
      expect(executionFailures(execution, result, shard, 'head', 'initial', 'runner-1')).toEqual(
        []
      );
      execution[field] = 'foreign';
      expect(
        executionFailures(execution, result, shard, 'head', 'initial', 'runner-1')
      ).toHaveLength(1);
    }
  );
  it('rejects invalid selectors instead of silently skipping security coverage', () => {
    const all = [{ key: 'a' }, { key: 'b' }];
    expect(selectKeys(all, ['b'])).toEqual([{ key: 'b' }]);
    for (const selected of [[], ['foreign'], ['a', 'a']])
      expect(() => selectKeys(all, selected)).toThrow();
  });
  it('preserves the complete security mutation sequence for each selection', async () => {
    const expected = await securityCaseManifest();
    const selected = new Set(
      expected.filter((_, index) => index % 2 === 0).map(entry => entry.key)
    );
    const execute = async (filtered: boolean) => {
      const statements: string[] = [],
        measured: string[] = [];
      const sql = (async (parts: TemplateStringsArray) => {
        statements.push(parts.join('?'));
        return [];
      }) as any;
      await securityScenarios(sql, async (name, variant, _args, actor) => {
        const key = securityKey(name, variant, actor);
        if (!filtered || selected.has(key)) measured.push(key);
      });
      return { statements, measured };
    };
    const full = await execute(false),
      filtered = await execute(true);
    expect(filtered.statements).toEqual(full.statements);
    expect(filtered.measured).toEqual(
      expected.filter(entry => selected.has(entry.key)).map(entry => entry.key)
    );
    expect(new Set(full.measured).size).toBe(expected.length);
  });
});

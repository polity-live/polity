import { createHash } from 'node:crypto';
import { mutators } from '../../../src/zero/mutators';
import { coreMutationCases } from './mutation-cases-core';
import { contentMutationCases } from './mutation-cases-content';
import { governanceMutationCases } from './mutation-cases-governance';
import { amendmentMutationCases } from './mutation-cases-amendments';
import { canonical } from './sharding';
import type { MutationCase } from './mutation-case-types';
import type { MutationExpectation } from './mutation-metrics';

export function registeredMutationNames(registry: unknown = mutators): string[] {
  const names: string[] = [];
  function visit(tree: unknown) {
    if (!tree || typeof tree !== 'object') return;
    for (const [key, child] of Object.entries(tree)) {
      if (key === '~') continue;
      if (
        typeof child === 'function' &&
        typeof (child as { mutatorName?: unknown }).mutatorName === 'string'
      )
        names.push((child as unknown as { mutatorName: string }).mutatorName);
      else visit(child);
    }
  }
  visit(registry);
  if (!names.length || new Set(names).size !== names.length)
    throw new Error('Invalid mutation registry');
  return names.sort();
}
export function mutationKey(entry: Pick<MutationCase, 'name' | 'variant' | 'actor'>) {
  return `mutation/${entry.name}/${entry.variant}/${entry.actor}`;
}
export function mutationExpectation(entry: MutationCase): MutationExpectation {
  return {
    key: mutationKey(entry),
    name: entry.name,
    variant: entry.variant,
    actor: entry.actor,
    outcome: entry.outcome,
    ...(entry.error ? { error: entry.error } : {}),
    observer: entry.observer,
    oracleDigest: createHash('sha256')
      .update(
        canonical({
          specification: entry.specification,
          name: entry.name,
          variant: entry.variant,
          actor: entry.actor,
          outcome: entry.outcome,
          error: entry.error,
          observer: entry.observer,
        })
      )
      .digest('hex'),
  };
}
export function validateMutationCases(entries: MutationCase[], names = registeredMutationNames()) {
  const keys = entries.map(mutationKey);
  const failures = [
    ...(new Set(keys).size !== keys.length ? ['Duplicate mutation cases'] : []),
    ...names
      .filter(name => !entries.some(entry => entry.name === name))
      .map(name => `Missing mutation cases: ${name}`),
    ...entries
      .filter(entry => !names.includes(entry.name))
      .map(entry => `Unregistered mutation case: ${entry.name}`),
  ];
  for (const entry of entries) {
    if (
      !entry.variant.trim() ||
      !entry.actor.trim() ||
      !entry.specification ||
      !entry.observer ||
      ('reason' in entry.observer && !entry.observer.reason.trim()) ||
      ('query' in entry.observer && !entry.observer.query.trim()) ||
      (entry.outcome !== 'success' && !entry.error)
    )
      failures.push(`Invalid mutation case: ${mutationKey(entry)}`);
  }
  return failures;
}
export function loadMutationCases() {
  return [
    ...coreMutationCases(),
    ...contentMutationCases(),
    ...governanceMutationCases(),
    ...amendmentMutationCases(),
  ].sort((a, b) => mutationKey(a).localeCompare(mutationKey(b), 'en'));
}
export function mutationCaseManifest() {
  const entries = loadMutationCases();
  const failures = validateMutationCases(entries);
  if (failures.length) throw new Error(failures.join('\n'));
  return entries.map(mutationExpectation);
}

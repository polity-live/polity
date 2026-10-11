import { access } from 'node:fs/promises';
import type { MutationCase } from './mutation-case-types';
import type { MutationExpectation } from './mutation-metrics';

/** Workload definitions belong to the revision, never to the overlaid harness. */
export async function mutationInventory(filter?: string): Promise<{
  expectations: MutationExpectation[];
  cases: MutationCase[];
  bootstrap?: string;
}> {
  try {
    await access(new URL('./mutation-catalog.ts', import.meta.url));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return {
      expectations: [],
      cases: [],
      bootstrap: 'Revision predates the mutation catalog; query comparison remains enabled.',
    };
  }
  const catalog = await import('./mutation-catalog');
  if (filter) {
    const cases = catalog.loadMutationCases().filter(entry => entry.name === filter);
    if (!catalog.registeredMutationNames().includes(filter) || !cases.length)
      throw new Error('Mutation filter has no registered catalog cases');
    const failures = catalog.validateMutationCases(cases, [filter]);
    if (failures.length) throw new Error(failures.join('; '));
    return { cases, expectations: cases.map(catalog.mutationExpectation) };
  }
  return { expectations: catalog.mutationCaseManifest(), cases: catalog.loadMutationCases() };
}

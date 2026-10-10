import { describe, expect, it } from 'vitest';
import { amendmentMutationCases } from '../mutation-cases-amendments';
import { amendmentSharedMutators } from '../../../../src/zero/amendments/shared-mutators';

describe('reviewed amendment catalog', () => {
  const cases = amendmentMutationCases();
  it('covers the exact runtime registry; public orchestrators have substantive success cases', () => {
    expect([...new Set(cases.map(item => item.name))].sort()).toEqual(
      Object.keys(amendmentSharedMutators)
        .map(name => `amendments.${name}`)
        .sort()
    );
    for (const operation of [
      'initializeProcessPath',
      'resolveProcessVote',
      'completeProcessTaskWithEvent',
      'replanProcessBranchEvents',
      'updateProcessBranch',
      'createDocumentChangeRequest',
      'repairInternalChangeRequestResolution',
    ])
      expect(
        cases.some(item => item.name === `amendments.${operation}` && item.outcome === 'success')
      ).toBe(true);
  });
  it('uses permission_denied only for reviewed explicit denials and unique actor variants', () => {
    expect(new Set(cases.map(item => `${item.name}/${item.actor}/${item.variant}`)).size).toBe(
      cases.length
    );
    for (const item of cases) {
      expect(JSON.parse(JSON.stringify(item.specification))).toEqual(item.specification);
      if (item.outcome !== 'success') expect(item.error).toBe('permission_denied');
      expect('query' in item.observer).toBe(true);
    }
  });
});

import { describe, expect, it } from 'vitest';
import type { MutationBrowserResult } from '../mutation-browser';
import { MUTATION_BROWSER_ACTIONS, mutationBrowserFailures } from '../mutation-browser-metrics';
const rows = (): MutationBrowserResult[] =>
  MUTATION_BROWSER_ACTIONS.map(action => ({
    action,
    uiMs: 50,
    serverConfirmedMs: 150,
    finalVisibleMs: 200,
    reloadVerified: true,
    reloadVerificationMs: 3_000,
    serverOutcome: 'success',
    databaseVerified: true,
    failures: [],
    confirmationSource: 'independent-sql',
    confirmationSemantics: 'committed-state-observation-upper-bound',
    uiEvidence: 'Expected updated visible state',
    ...(action === 'vote'
      ? {
          rejection: {
            action: 'votingPassword.verifyVotingPassword',
            serverOutcome: 'server-error' as const,
            databaseUnchanged: true,
          },
        }
      : {}),
  }));
describe('browser mutation acceptance', () => {
  it('requires all actions and a real denied server operation', () => {
    expect(mutationBrowserFailures(rows())).toEqual([]);
    expect(mutationBrowserFailures(undefined)).toContain('Missing browser mutation evidence');
    const missing = rows().slice(0, 3);
    expect(mutationBrowserFailures(missing)).toContain('Missing browser server rejection proof');
    expect(mutationBrowserFailures([rows()[0], ...rows().slice(1, 3), rows()[0]])).toContain(
      'Missing or duplicate browser mutation actions'
    );
  });
  it('rejects missing and invalid measured phases instead of zero-filling them', () => {
    for (const value of [null, NaN, Infinity, -1]) {
      const input = rows();
      input[0].uiMs = value;
      expect(mutationBrowserFailures(input)).toContain('save: Missing or invalid uiMs');
    }
  });
  it('keeps inclusive existing browser boundaries and distinguishes SQL observation from SDK ACK', () => {
    const input = rows();
    input[0].uiMs = 1_000;
    input[0].finalVisibleMs = 1_000;
    expect(mutationBrowserFailures(input)).toEqual([]);
    input[0].uiMs = 1_001;
    input[0].finalVisibleMs = 1_001;
    expect(mutationBrowserFailures(input)).toContain('Browser mutation save uiMs exceeds 1000 ms');
    expect(mutationBrowserFailures(input, false)).toEqual([]);
    input[0].uiEvidence = '';
    expect(mutationBrowserFailures(input, false)).toContain(
      'save: Missing independent UI/confirmation semantics'
    );
  });
  it('requires reload durability proof without charging a separate navigation to mutation latency', () => {
    expect(mutationBrowserFailures(rows())).toEqual([]);
    const input = rows();
    input[0].reloadVerified = false;
    expect(mutationBrowserFailures(input)).toContain(
      'save: Missing or invalid independent reload proof'
    );
    input[0].reloadVerified = true;
    for (const value of [null, NaN, Infinity, -1]) {
      input[0].reloadVerificationMs = value;
      expect(mutationBrowserFailures(input)).toContain(
        'save: Missing or invalid independent reload proof'
      );
    }
  });
  it('rejects an impossible final-visible timestamp even when absolute budgets are disabled', () => {
    const input = rows();
    input[0].finalVisibleMs = 149;
    expect(mutationBrowserFailures(input, false)).toContain(
      'save: Final visible state precedes UI or committed-state proof'
    );
    input[0].serverConfirmedMs = 40;
    input[0].finalVisibleMs = 49;
    expect(mutationBrowserFailures(input, false)).toContain(
      'save: Final visible state precedes UI or committed-state proof'
    );
  });
});

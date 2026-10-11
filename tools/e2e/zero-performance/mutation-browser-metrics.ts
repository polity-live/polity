import type { MutationBrowserResult } from './mutation-browser';
export const MUTATION_BROWSER_ACTIONS = [
  'save',
  'send-message',
  'change-membership',
  'vote',
] as const;
export function mutationBrowserFailures(
  rows: MutationBrowserResult[] | undefined,
  absolute = true
) {
  if (!Array.isArray(rows)) return ['Missing browser mutation evidence'];
  const failures: string[] = [];
  if (
    rows.length !== MUTATION_BROWSER_ACTIONS.length ||
    new Set(rows.map(row => row.action)).size !== rows.length ||
    MUTATION_BROWSER_ACTIONS.some(action => !rows.some(row => row.action === action))
  )
    failures.push('Missing or duplicate browser mutation actions');
  for (const row of rows) {
    if (
      row.serverOutcome !== 'success' ||
      !row.databaseVerified ||
      row.confirmationSource !== 'independent-sql'
    )
      failures.push(`${row.action}: Missing committed database proof`);
    if (
      row.confirmationSemantics !== 'committed-state-observation-upper-bound' ||
      !row.uiEvidence?.trim()
    )
      failures.push(`${row.action}: Missing independent UI/confirmation semantics`);
    if (
      row.reloadVerified !== true ||
      typeof row.reloadVerificationMs !== 'number' ||
      !Number.isFinite(row.reloadVerificationMs) ||
      row.reloadVerificationMs < 0
    )
      failures.push(`${row.action}: Missing or invalid independent reload proof`);
    for (const field of ['uiMs', 'serverConfirmedMs', 'finalVisibleMs'] as const) {
      const value = row[field];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
        failures.push(`${row.action}: Missing or invalid ${field}`);
      else if (absolute && value > 1_000)
        failures.push(`Browser mutation ${row.action} ${field} exceeds 1000 ms`);
    }
    if (
      typeof row.uiMs === 'number' &&
      typeof row.serverConfirmedMs === 'number' &&
      typeof row.finalVisibleMs === 'number' &&
      row.finalVisibleMs < Math.max(row.uiMs, row.serverConfirmedMs)
    )
      failures.push(`${row.action}: Final visible state precedes UI or committed-state proof`);
    failures.push(...row.failures.map(failure => `${row.action}: ${failure}`));
  }
  const rejection = rows.find(row => row.action === 'vote')?.rejection;
  if (
    !rejection ||
    rejection.serverOutcome !== 'server-error' ||
    !rejection.databaseUnchanged ||
    rejection.action !== 'votingPassword.verifyVotingPassword'
  )
    failures.push('Missing browser server rejection proof');
  return failures;
}

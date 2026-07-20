import { normalizeEditingMode, type EditingMode } from '@/zero/amendments/editing-mode-policy';

export function normalizeAmendmentStatus(status?: string): EditingMode {
  return normalizeEditingMode(status?.toLowerCase());
}

export function normalizeVotePhase(status?: string) {
  if (!status) return 'open';
  const normalized = status.toLowerCase();
  if (
    normalized === 'open' ||
    normalized === 'closing_soon' ||
    normalized === 'last_hour' ||
    normalized === 'final_minutes' ||
    normalized === 'passed' ||
    normalized === 'failed' ||
    normalized === 'tied'
  ) {
    return normalized as
      'open' | 'closing_soon' | 'last_hour' | 'final_minutes' | 'passed' | 'failed' | 'tied';
  }
  return 'open';
}

export function normalizeElectionStatus(status?: string) {
  if (!status) return 'voting_open';
  const normalized = status.toLowerCase();
  if (
    normalized === 'nominations_open' ||
    normalized === 'voting_open' ||
    normalized === 'closed' ||
    normalized === 'runoff_required' ||
    normalized === 'no_winner' ||
    normalized === 'winner_announced'
  ) {
    return (
      normalized === 'runoff_required' || normalized === 'no_winner' ? 'closed' : normalized
    ) as 'nominations_open' | 'voting_open' | 'closed' | 'winner_announced';
  }
  return 'voting_open';
}

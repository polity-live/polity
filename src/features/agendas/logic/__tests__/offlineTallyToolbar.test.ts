import { describe, expect, it } from 'vitest';
import {
  resolveOfflineTallyPhase,
  shouldShowOfflineTallyToolbarButton,
  type OfflineTallyPhase,
} from '../offlineTallyToolbar';

function buildArgs(overrides?: {
  attendanceMode?: string | null;
  canManageVotes?: boolean;
  phase?: OfflineTallyPhase | null;
}) {
  return {
    attendanceMode: 'offline',
    canManageVotes: true,
    phase: 'indicative' as OfflineTallyPhase,
    ...overrides,
  };
}

describe('shouldShowOfflineTallyToolbarButton', () => {
  it('returns true for offline events with manage_votes and a final tally phase', () => {
    expect(shouldShowOfflineTallyToolbarButton(buildArgs({ phase: 'final' }))).toBe(true);
  });

  it('returns false for indicative offline tally phases', () => {
    expect(shouldShowOfflineTallyToolbarButton(buildArgs())).toBe(false);
  });

  it('returns false without manage_votes', () => {
    expect(shouldShowOfflineTallyToolbarButton(buildArgs({ canManageVotes: false }))).toBe(false);
  });

  it('returns true for hybrid attendance mode', () => {
    expect(
      shouldShowOfflineTallyToolbarButton(buildArgs({ attendanceMode: 'hybrid', phase: 'final' }))
    ).toBe(true);
  });

  it('returns false for online attendance mode', () => {
    expect(shouldShowOfflineTallyToolbarButton(buildArgs({ attendanceMode: 'online' }))).toBe(
      false
    );
  });

  it('returns false when no eligible offline tally phase exists', () => {
    expect(shouldShowOfflineTallyToolbarButton(buildArgs({ phase: null }))).toBe(false);
  });
});

describe('resolveOfflineTallyPhase', () => {
  it('defaults to indicative for eligible offline tallies without an explicit phase', () => {
    expect(
      resolveOfflineTallyPhase({
        allowsOfflineTallies: true,
        canManageOfflineTallies: true,
        votingPhase: null,
      })
    ).toBe('indicative');
  });

  it('uses indicative during pending voting', () => {
    expect(
      resolveOfflineTallyPhase({
        allowsOfflineTallies: true,
        canManageOfflineTallies: true,
        votingPhase: 'pending',
      })
    ).toBe('indicative');
  });

  it('uses final during final vote', () => {
    expect(
      resolveOfflineTallyPhase({
        allowsOfflineTallies: true,
        canManageOfflineTallies: true,
        votingPhase: 'final',
      })
    ).toBe('final');
  });

  it('uses final for raw final status too', () => {
    expect(
      resolveOfflineTallyPhase({
        allowsOfflineTallies: true,
        canManageOfflineTallies: true,
        votingPhase: 'final',
      })
    ).toBe('final');
  });
});

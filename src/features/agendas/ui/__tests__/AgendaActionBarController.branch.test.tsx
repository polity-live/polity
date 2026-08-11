/* @vitest-environment jsdom */

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  view: vi.fn((_props: unknown) => <div />),
}));

vi.mock('@/features/agendas/ui/AgendaActionBarView', () => ({
  AgendaActionBarView: (props: unknown) => mocks.view(props),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { AgendaActionBar } from '../AgendaActionBar';

beforeEach(() => vi.clearAllMocks());

const base = (overrides: Record<string, unknown> = {}) =>
  ({
    eventId: 'event-1',
    currentAgendaItem: {
      id: 'agenda-1',
      type: 'vote',
      status: 'pending',
      voting_phase: 'final',
      vote: { id: 'vote-1' },
    },
    canManageAgenda: true,
    canVote: true,
    canBeCandidate: true,
    isEventStarted: true,
    isUserInSpeakerList: false,
    isUserCandidate: false,
    onStartItem: vi.fn(),
    onVoteClick: vi.fn(),
    ...overrides,
  }) as any;

describe('AgendaActionBar controller', () => {
  it('does not start an explicitly completed current item', () => {
    render(
      <AgendaActionBar
        {...base({
          currentAgendaItem: {
            id: 'agenda-1',
            type: 'vote',
            status: 'completed',
            voting_phase: 'closed',
          },
        })}
      />
    );
    expect(mocks.view).toHaveBeenCalledWith(
      expect.objectContaining({ canStartCurrentItem: false, showStartButton: false })
    );
  });

  it('falls back to the phase tooltip when a disabled vote has no custom tooltip', () => {
    render(<AgendaActionBar {...base({ disableVoteButton: true, disabledVoteTooltip: '' })} />);
    expect(mocks.view).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultVoteTooltip: 'features.events.agenda.actions.castFinalVote',
        voteTooltip: 'features.events.agenda.actions.castFinalVote',
      })
    );
  });
});

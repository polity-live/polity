/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditElectionVoteDialogController } from '../useEditElectionVoteDialogController';

const agendaActions = {
  updateAgendaItem: vi.fn(),
};
const electionActions = {
  updateElection: vi.fn(),
};
const voteActions = {
  updateVote: vi.fn(),
  createVoteChoice: vi.fn(),
  deleteVoteChoice: vi.fn(),
};
const waitForClientApply = vi.fn(async (value: unknown) => await value);

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => agendaActions,
}));
vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => electionActions,
}));
vi.mock('@/zero/votes/useVoteActions', () => ({
  useVoteActions: () => voteActions,
}));
vi.mock('@/zero/shared', () => ({
  resolveElectionBallotVisibility: (value: string | null | undefined) =>
    value === 'named' ? 'named' : 'secret',
  resolveVoteBallotVisibility: (value: string | null | undefined) =>
    value === 'named' ? 'named' : 'secret',
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (value: unknown) => waitForClientApply(value),
}));

beforeEach(() => {
  vi.clearAllMocks();
  agendaActions.updateAgendaItem.mockResolvedValue(undefined);
  electionActions.updateElection.mockResolvedValue(undefined);
  voteActions.updateVote.mockResolvedValue(undefined);
  voteActions.createVoteChoice.mockResolvedValue(undefined);
  voteActions.deleteVoteChoice.mockResolvedValue(undefined);
});

describe('useEditElectionVoteDialogController', () => {
  it('provides defaults while closed and ignores an empty choice label', () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useEditElectionVoteDialogController({ open: false, onOpenChange })
    );

    expect(result.current).toEqual(
      expect.objectContaining({
        isElection: false,
        entity: undefined,
        majorityType: 'relative',
        closingType: 'moderator',
        closingDuration: 5,
        visibility: 'public',
        ballotVisibility: 'secret',
        maxVotes: 1,
        title: '',
        description: '',
        duration: 30,
        choices: [],
      })
    );

    act(() => {
      result.current.setNewChoiceLabel('   ');
    });
    act(() => {
      result.current.handleAddChoice();
    });
    expect(result.current.localChoices).toEqual([]);
  });

  it('syncs complete election settings when opened and edits the local choices', async () => {
    const election = {
      id: 'election-1',
      majority_type: 'absolute',
      closing_type: 'time',
      closing_duration_seconds: 180,
      visibility: 'group',
      ballot_visibility: 'named',
      max_votes: 3,
    };
    const choices = [{ id: 'old', label: 'Old', order_index: 0 }];
    const { result } = renderHook(() =>
      useEditElectionVoteDialogController({
        open: true,
        onOpenChange: vi.fn(),
        agendaItemId: 'agenda-1',
        agendaItemTitle: 'Election title',
        agendaItemDescription: 'Election description',
        agendaItemDuration: 45,
        election,
        choices,
      })
    );

    await waitFor(() => expect(result.current.maxVotes).toBe(3));
    expect(result.current).toEqual(
      expect.objectContaining({
        isElection: true,
        entity: election,
        majorityType: 'absolute',
        closingType: 'time',
        closingDuration: 3,
        visibility: 'group',
        ballotVisibility: 'named',
        title: 'Election title',
        description: 'Election description',
        duration: 45,
      })
    );

    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce(
      '00000000-0000-4000-8000-000000000001'
    );
    act(() => {
      result.current.setNewChoiceLabel('  New choice  ');
    });
    act(() => {
      result.current.handleAddChoice();
    });
    expect(result.current.localChoices.at(-1)).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      label: 'New choice',
      order_index: 1,
    });
    expect(result.current.newChoiceLabel).toBe('');

    act(() => {
      result.current.handleRemoveChoice('old');
    });
    expect(result.current.localChoices.map(choice => choice.id)).toEqual([
      '00000000-0000-4000-8000-000000000001',
    ]);
    act(() => {
      result.current.handleRemoveChoice('missing');
    });
    expect(result.current.localChoices).toHaveLength(1);
  });

  it('resets nullable election settings and invalid agenda metadata on reopen', async () => {
    const onOpenChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ open }) =>
        useEditElectionVoteDialogController({
          open,
          onOpenChange,
          agendaItemTitle: null,
          agendaItemDescription: null,
          agendaItemDuration: 0,
          election: {
            id: 'election-1',
            majority_type: null,
            closing_type: null,
            closing_duration_seconds: null,
            visibility: null,
            ballot_visibility: null,
            max_votes: undefined,
          },
        }),
      { initialProps: { open: false } }
    );

    rerender({ open: true });
    await waitFor(() => expect(result.current.majorityType).toBe('relative'));
    expect(result.current).toEqual(
      expect.objectContaining({
        closingType: 'moderator',
        closingDuration: 5,
        visibility: 'public',
        maxVotes: 1,
        title: '',
        description: '',
        duration: 30,
      })
    );
  });

  it('saves an election and its agenda item with normalized values', async () => {
    const onOpenChange = vi.fn();
    const election = { id: 'election-1' };
    const { result } = renderHook(() =>
      useEditElectionVoteDialogController({
        open: true,
        onOpenChange,
        agendaItemId: 'agenda-1',
        agendaItemTitle: 'Initial title',
        agendaItemDescription: 'Initial description',
        agendaItemDuration: 10,
        election,
      })
    );

    await waitFor(() => expect(result.current.title).toBe('Initial title'));

    act(() => {
      result.current.setClosingType('time');
      result.current.setClosingDuration(4);
      result.current.setTitle('  Election title  ');
      result.current.setDescription('  Description  ');
      result.current.setDuration(0);
      result.current.setMaxVotes(2);
      result.current.setBallotVisibility('named');
    });
    await waitFor(() => expect(result.current.title).toBe('  Election title  '));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(agendaActions.updateAgendaItem).toHaveBeenCalledWith({
      id: 'agenda-1',
      title: 'Election title',
      description: 'Description',
      duration: 1,
    });
    expect(electionActions.updateElection).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'election-1',
        description: 'Description',
        closing_duration_seconds: 240,
        ballot_visibility: 'named',
        max_votes: 2,
      })
    );
    expect(voteActions.updateVote).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(result.current.saving).toBe(false);
  });

  it('saves a vote, adding and deleting only changed choices', async () => {
    const onOpenChange = vi.fn();
    const vote = { id: 'vote-1', ballot_visibility: 'named' };
    const choices = [
      { id: 'keep', label: 'Keep', order_index: 0 },
      { id: 'delete', label: 'Delete', order_index: 1 },
    ];
    const { result } = renderHook(() =>
      useEditElectionVoteDialogController({
        open: true,
        onOpenChange,
        vote,
        choices,
      })
    );

    act(() => {
      result.current.setTitle('   ');
      result.current.setDescription('   ');
      result.current.setDuration(Number.NaN);
      result.current.setLocalChoices([choices[0], { id: 'new', label: 'New', order_index: 1 }]);
    });
    await waitFor(() =>
      expect(result.current.localChoices.some(choice => choice.id === 'new')).toBe(true)
    );
    await act(async () => {
      await result.current.handleSave();
    });

    expect(agendaActions.updateAgendaItem).not.toHaveBeenCalled();
    expect(electionActions.updateElection).not.toHaveBeenCalled();
    expect(voteActions.updateVote).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'vote-1',
        description: null,
        closing_duration_seconds: null,
        ballot_visibility: 'named',
      })
    );
    expect(voteActions.createVoteChoice).toHaveBeenCalledTimes(1);
    expect(voteActions.createVoteChoice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new', vote_id: 'vote-1' })
    );
    expect(voteActions.deleteVoteChoice).toHaveBeenCalledWith('delete');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('saves agenda-only edits and handles guards and action failures', async () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useEditElectionVoteDialogController({
        open: true,
        onOpenChange,
        agendaItemId: 'agenda-1',
      })
    );

    await act(async () => {
      await result.current.handleSave();
    });
    expect(agendaActions.updateAgendaItem).toHaveBeenCalledTimes(1);
    expect(electionActions.updateElection).not.toHaveBeenCalled();
    expect(voteActions.updateVote).not.toHaveBeenCalled();

    agendaActions.updateAgendaItem.mockRejectedValueOnce(new Error('update failed'));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(result.current.saving).toBe(false);

    const guard = renderHook(() =>
      useEditElectionVoteDialogController({ open: true, onOpenChange })
    );
    await act(async () => {
      await guard.result.current.handleSave();
    });
    expect(guard.result.current.saving).toBe(false);
  });
});

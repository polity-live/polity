import { describe, expect, it } from 'vitest';

import { getFinalVoteActionLabels } from '../finalVoteActionLabels';

describe('final vote action labels', () => {
  it('labels final change request vote actions with the branch-scoped CR id', () => {
    const labels = getFinalVoteActionLabels({
      item: {
        change_request: {
          display_cr_id: 'Branch 2 CR-2',
          cr_id: 'CR-2',
          title: 'Change title fallback',
        },
        vote: { purpose: 'change_request' },
      },
    });

    expect(labels.kind).toBe('change_request');
    expect(labels.start).toBe('Start final change request vote: Branch 2 CR-2');
    expect(labels.close).toBe('Close final change request vote: Branch 2 CR-2');
  });

  it('labels final closing vote actions with the amendment title', () => {
    const labels = getFinalVoteActionLabels({
      amendmentTitle: 'Amendment Motion A',
      agendaTitle: 'Agenda title fallback',
      item: {
        is_closing_vote: true,
        vote: {
          purpose: 'closing',
          title: 'Vote title fallback',
        },
      },
    });

    expect(labels.kind).toBe('closing');
    expect(labels.start).toBe('Start final closing vote: Amendment Motion A');
    expect(labels.close).toBe('Close final closing vote: Amendment Motion A');
  });

  it('labels merge vote actions with ordered non-abstain branch labels joined by VS', () => {
    const labels = getFinalVoteActionLabels({
      item: {
        _voteStepKind: 'merge_variant',
        vote: {
          purpose: 'merge_variant',
          choices: [
            { label: 'Branch 2', order_index: 1 },
            { label: 'Abstain', semantic_key: 'abstain', order_index: 2 },
            { label: 'Branch 1', order_index: 0 },
          ],
        },
      },
    });

    expect(labels.kind).toBe('merge');
    expect(labels.start).toBe('Start final merge vote Branch 1 VS Branch 2');
    expect(labels.close).toBe('Close final merge vote Branch 1 VS Branch 2');
  });

  it('uses merge_variant purpose as a merge vote', () => {
    const labels = getFinalVoteActionLabels({
      item: {
        _voteStepKind: 'merge_variant',
        vote: {
          purpose: 'merge_variant',
          choices: [
            { process_branch_id: 'branch-1', order_index: 0 },
            { process_branch_id: 'branch-2', order_index: 1 },
          ],
        },
      },
      branchLabelsById: new Map([
        ['branch-1', 'Branch 1'],
        ['branch-2', 'Branch 2'],
      ]),
    });

    expect(labels.kind).toBe('merge');
    expect(labels.start).toBe('Start final merge vote Branch 1 VS Branch 2');
  });

  it('uses closing purpose as a closing vote', () => {
    const labels = getFinalVoteActionLabels({
      agendaTitle: 'Agenda Motion B',
      item: {
        _voteStepKind: 'closing',
        vote: {
          purpose: 'closing',
          title: 'Vote title fallback',
        },
      },
    });

    expect(labels.kind).toBe('closing');
    expect(labels.start).toBe('Start final closing vote: Agenda Motion B');
    expect(labels.close).toBe('Close final closing vote: Agenda Motion B');
  });
});

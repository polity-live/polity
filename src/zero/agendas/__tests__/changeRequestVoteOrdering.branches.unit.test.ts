import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createChangeRequestVoteOrderContext,
  orderChangeRequestsForVoting,
  reorderOpenChangeRequestVoteStepsForAgendaItem,
  reorderOpenChangeRequestVoteStepsForEvent,
} from '../change-request-vote-ordering';

function createTx(results: unknown[]) {
  const queue = [...results];
  return {
    run: vi.fn(async () => queue.shift()),
    mutate: { agenda_item_change_request: { update: vi.fn() } },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('change request vote ordering branches', () => {
  it('handles an amendment without branch or document metadata', async () => {
    const tx = createTx([{ id: 'amendment-1', document_id: null, discussions: 'legacy' }]);
    const context = await createChangeRequestVoteOrderContext(tx, 'amendment-1', [
      { id: 'cr-1', process_branch_id: null },
    ]);

    expect(context.getTextPosition({ id: 'cr-1', process_branch_id: null })).toBeNull();
    expect(context.getTextPosition({ id: 'cr-2', process_branch_id: 'unknown' })).toBeNull();
    expect(tx.run).toHaveBeenCalledTimes(1);
    await expect(
      orderChangeRequestsForVoting(tx, 'amendment-1', [{ id: 'only' }], 'text_position')
    ).resolves.toEqual([{ id: 'only' }]);
  });

  it('resolves aliases and document-version positions for branch change requests', async () => {
    const tx = createTx([
      {
        id: 'amendment-1',
        document_id: 'document-main',
        discussions: [
          { id: null, changeRequestEntityId: 'ignored' },
          { id: 'suggestion-main', changeRequestEntityId: 'CR-7' },
        ],
      },
      [
        {
          id: 'branch-1',
          document_id: null,
          document_version_id: 'version-1',
          discussions: [
            { id: 'suggestion-branch', change_request_id: 'cr-branch' },
            { id: 'suggestion-empty', crId: ' ' },
            { id: 'suggestion-no-position', change_request_id: 'cr-no-position' },
          ],
        },
        { id: null, document_version_id: '', discussions: [] },
      ],
      [
        {
          id: 'document-main',
          content: [
            { type: 'p', children: [{ text: 'main', suggestion_main: { id: 'suggestion-main' } }] },
          ],
        },
      ],
      [
        {
          id: 'version-1',
          content: [
            {
              type: 'p',
              children: [{ text: 'branch', suggestion_branch: { id: 'suggestion-branch' } }],
            },
          ],
        },
      ],
    ]);
    const context = await createChangeRequestVoteOrderContext(tx, 'amendment-1', [
      { id: 'cr-main', branch_sequence_number: 7, process_branch_id: null },
      { id: 'cr-branch', process_branch_id: 'branch-1' },
    ]);

    expect(
      context.getTextPosition({ id: 'cr-main', branch_sequence_number: 7, process_branch_id: null })
    ).toBe(1);
    expect(context.getTextPosition({ id: 'cr-branch', process_branch_id: 'branch-1' })).toBe(1);
    expect(
      context.getTextPosition({ id: 'cr-no-position', process_branch_id: 'branch-1' })
    ).toBeNull();
    expect(context.getTextPosition({ id: 'missing', process_branch_id: 'branch-1' })).toBeNull();
  });

  it('orders multiple change requests by their resolved text positions', async () => {
    const tx = createTx([
      {
        id: 'amendment-1',
        document_id: 'document-1',
        discussions: [
          { id: 'suggestion-a', changeRequestEntityId: 'a' },
          { id: 'suggestion-b', changeRequestEntityId: 'b' },
        ],
      },
      [
        {
          id: 'document-1',
          content: [
            { type: 'p', children: [{ text: 'B', suggestion_b: { id: 'suggestion-b' } }] },
            { type: 'p', children: [{ text: 'A', suggestion_a: { id: 'suggestion-a' } }] },
          ],
        },
      ],
    ]);

    await expect(
      orderChangeRequestsForVoting(
        tx,
        'amendment-1',
        [
          { id: 'a', process_branch_id: null },
          { id: 'b', process_branch_id: null },
        ],
        'text_position'
      )
    ).resolves.toEqual([
      expect.objectContaining({ id: 'b' }),
      expect.objectContaining({ id: 'a' }),
    ]);
  });

  it('skips malformed event agenda rows and delegates only complete rows', async () => {
    const tx = createTx(['not-an-array']);
    await reorderOpenChangeRequestVoteStepsForEvent(tx, 'event-1', 'changed_character_count');
    expect(tx.run).toHaveBeenCalledTimes(1);

    const incomplete = createTx([
      [
        { id: null, amendment_id: 'a' },
        { id: 'agenda-1' },
        { id: 'agenda-2', amendment_id: 'amendment-2' },
      ],
      [],
    ]);
    await reorderOpenChangeRequestVoteStepsForEvent(
      incomplete,
      'event-1',
      'changed_character_count'
    );
    expect(incomplete.run).toHaveBeenCalledTimes(2);
  });

  it('returns before loading links for incomplete agenda items', async () => {
    const tx = createTx([]);
    await reorderOpenChangeRequestVoteStepsForAgendaItem(
      tx,
      { id: null, amendment_id: 'amendment-1' },
      'changed_character_count'
    );
    await reorderOpenChangeRequestVoteStepsForAgendaItem(
      tx,
      { id: 'agenda-1', amendment_id: null },
      'changed_character_count'
    );
    expect(tx.run).not.toHaveBeenCalled();

    const empty = createTx([[]]);
    await reorderOpenChangeRequestVoteStepsForAgendaItem(
      empty,
      { id: 'agenda-1', amendment_id: 'amendment-1' },
      'changed_character_count'
    );
    expect(empty.run).toHaveBeenCalledTimes(1);
  });

  it('filters closed and non-change-request steps and rewrites changed positions only', async () => {
    const links = [
      { id: 'missing-id', change_request_id: null, change_request: { id: 'x' } },
      { id: 'missing-row', change_request_id: 'x', change_request: null },
      {
        id: 'closing',
        change_request_id: 'closing',
        change_request: { id: 'closing' },
        is_closing_vote: true,
      },
      {
        id: 'merge',
        change_request_id: 'merge',
        change_request: { id: 'merge' },
        step_kind: 'merge_variant',
      },
      {
        id: 'completed',
        change_request_id: 'completed',
        change_request: { id: 'completed' },
        status: 'completed',
      },
      {
        id: 'final',
        change_request_id: 'final',
        change_request: { id: 'final' },
        vote: { status: 'final' },
      },
      {
        id: 'closed',
        change_request_id: 'closed',
        change_request: { id: 'closed' },
        vote: { status: 'closed' },
      },
      {
        id: 'a',
        change_request_id: 'a',
        order_index: 1,
        change_request: { id: 'a', changed_character_count: 30, process_branch_id: null },
        vote: { status: 'indicative' },
      },
      {
        id: 'b',
        change_request_id: 'b',
        order_index: 0,
        change_request: { id: 'b', changed_character_count: 20, process_branch_id: null },
        vote: { status: 'pending' },
      },
      {
        id: 'c',
        change_request_id: 'c',
        order_index: null,
        change_request: { id: 'c', changed_character_count: 10, process_branch_id: null },
        vote: { status: null },
      },
    ];
    const tx = createTx([links, { id: 'amendment-1', document_id: null, discussions: [] }]);

    await reorderOpenChangeRequestVoteStepsForAgendaItem(
      tx,
      { id: 'agenda-1', amendment_id: 'amendment-1' },
      'changed_character_count'
    );

    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledTimes(2);
    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', order_index: 0 })
    );
    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b', order_index: 1 })
    );
  });

  it('leaves already sorted open steps unchanged', async () => {
    const links = [
      {
        id: 'a',
        change_request_id: 'a',
        order_index: 0,
        change_request: { id: 'a', changed_character_count: 30 },
      },
      {
        id: 'b',
        change_request_id: 'b',
        order_index: 1,
        change_request: { id: 'b', changed_character_count: 20 },
      },
    ];
    const tx = createTx([links, { id: 'amendment-1', document_id: null, discussions: [] }]);
    await reorderOpenChangeRequestVoteStepsForAgendaItem(
      tx,
      { id: 'agenda-1', amendment_id: 'amendment-1' },
      'changed_character_count'
    );
    expect(tx.mutate.agenda_item_change_request.update).not.toHaveBeenCalled();
  });
});

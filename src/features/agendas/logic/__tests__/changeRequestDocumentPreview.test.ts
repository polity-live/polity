import { describe, expect, it } from 'vitest';

import type { TDiscussion } from '@/features/editor/types';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';

import {
  buildCrIdToDiscussionId,
  buildSuggestionPreviewResolutions,
  buildVoteDialogDocumentPreviewModel,
  resolvePreviewCrIdForTimelineItem,
} from '../changeRequestDocumentPreview';

function discussion(overrides: Partial<TDiscussion> & { id: string }): TDiscussion {
  return {
    crId: null,
    title: '',
    userId: 'user-1',
    comments: [],
    createdAt: new Date(0),
    isResolved: false,
    ...overrides,
  } as TDiscussion;
}

function item(overrides: Partial<ChangeRequestTimelineRow>): ChangeRequestTimelineRow {
  return {
    id: 'item-1',
    agenda_item_id: 'agenda-1',
    change_request_id: 'cr-entity-1',
    vote_id: 'vote-1',
    order_index: 0,
    is_closing_vote: false,
    status: 'pending',
    created_at: 0,
    updated_at: 0,
    change_request: null,
    vote: null,
    ...overrides,
  } as ChangeRequestTimelineRow;
}

describe('change request document preview helpers', () => {
  it('ignores empty discussion ids and inactive vote result resolvers', () => {
    const map = buildCrIdToDiscussionId([
      discussion({ id: '' as any, crId: 'CR-empty' }),
      discussion({ id: 'discussion-1', crId: 'CR-1' }),
    ]);
    expect(map.has('')).toBe(false);

    const resolutions = buildSuggestionPreviewResolutions({
      items: [
        item({
          status: 'completed',
          change_request: { id: 'cr-1', cr_id: 'CR-1' } as any,
        }),
      ],
      crIdToDiscussionId: map,
      isVotingActive: false,
      getVoteResult: () => 'rejected',
    });
    expect(resolutions.get('discussion-1')).toBe('accept');
  });

  it('prefers the technical suggestion id over branch-local display ids', () => {
    const crIdToDiscussionId = buildCrIdToDiscussionId([
      discussion({ id: 'suggestion-real', crId: 'Global CR-4' }),
      discussion({ id: 'suggestion-branch-local', crId: 'Branch 1 CR-4' }),
    ]);
    const target = item({
      change_request_id: 'entity-4',
      change_request: {
        id: 'entity-4',
        title: 'Branch 1 CR-4',
        cr_id: 'Branch 1 CR-4',
        suggestion_id: 'suggestion-real',
      } as never,
    });

    expect(resolvePreviewCrIdForTimelineItem(target, crIdToDiscussionId)).toBe('suggestion-real');
  });

  it('builds a target preview and resolution map for accepted, rejected, and pending CRs', () => {
    const discussions = [
      discussion({ id: 'suggestion-target', changeRequestEntityId: 'target-entity' }),
      discussion({ id: 'suggestion-accepted', changeRequestEntityId: 'accepted-entity' }),
      discussion({ id: 'suggestion-rejected', changeRequestEntityId: 'rejected-entity' }),
      discussion({ id: 'suggestion-pending', changeRequestEntityId: 'pending-entity' }),
    ];
    const target = item({
      id: 'target',
      change_request_id: 'target-entity',
      change_request: { id: 'target-entity', suggestion_id: 'suggestion-target' } as never,
    });
    const accepted = item({
      id: 'accepted',
      status: 'completed',
      change_request_id: 'accepted-entity',
      change_request: { id: 'accepted-entity', suggestion_id: 'suggestion-accepted' } as never,
    });
    const rejected = item({
      id: 'rejected',
      status: 'completed',
      change_request_id: 'rejected-entity',
      change_request: { id: 'rejected-entity', suggestion_id: 'suggestion-rejected' } as never,
    });
    const pending = item({
      id: 'pending',
      status: 'voting',
      change_request_id: 'pending-entity',
      change_request: { id: 'pending-entity', suggestion_id: 'suggestion-pending' } as never,
    });

    const model = buildVoteDialogDocumentPreviewModel({
      activeItem: target,
      items: [target, accepted, rejected, pending],
      discussions,
      isVotingActive: true,
      getVoteResult: row => (row.id === 'rejected' ? 'rejected' : 'passed'),
    });

    if (!model) {
      throw new Error('Expected a document preview model');
    }

    expect([...model.suggestionIds]).toEqual(['suggestion-target']);
    expect(model.suggestionResolutions.get('suggestion-accepted')).toBe('accept');
    expect(model.suggestionResolutions.get('suggestion-rejected')).toBe('reject');
    expect(model.suggestionResolutions.has('suggestion-pending')).toBe(false);
  });

  it('builds closing vote previews without a target suggestion', () => {
    const crIdToDiscussionId = buildCrIdToDiscussionId([
      discussion({ id: 'suggestion-accepted', changeRequestEntityId: 'accepted-entity' }),
    ]);
    const accepted = item({
      id: 'accepted',
      status: 'completed',
      change_request_id: 'accepted-entity',
      change_request: { id: 'accepted-entity', suggestion_id: 'suggestion-accepted' } as never,
    });

    const resolutions = buildSuggestionPreviewResolutions({
      items: [accepted],
      crIdToDiscussionId,
      isVotingActive: true,
      getVoteResult: () => 'passed',
    });
    const model = buildVoteDialogDocumentPreviewModel({
      activeItem: item({
        id: 'closing',
        change_request_id: null,
        is_closing_vote: true,
        _voteStepKind: 'closing',
      } as never),
      items: [accepted],
      discussions: [
        discussion({ id: 'suggestion-accepted', changeRequestEntityId: 'accepted-entity' }),
      ],
      isVotingActive: true,
      getVoteResult: () => 'passed',
    });

    if (!model) {
      throw new Error('Expected a closing vote document preview model');
    }

    expect([...model.suggestionIds]).toEqual([]);
    expect(model.suggestionResolutions).toEqual(resolutions);
  });

  it('suppresses variant and placeholder rows', () => {
    const discussions = [discussion({ id: 'suggestion-1', changeRequestEntityId: 'entity-1' })];

    expect(
      buildVoteDialogDocumentPreviewModel({
        activeItem: item({ _voteStepKind: 'merge_variant' } as never),
        items: [],
        discussions,
        isVotingActive: true,
      })
    ).toBeNull();
    expect(
      buildVoteDialogDocumentPreviewModel({
        activeItem: item({
          is_closing_vote: true,
          _voteStepKind: 'closing_placeholder',
          _votePlaceholder: true,
        } as never),
        items: [],
        discussions,
        isVotingActive: true,
      })
    ).toBeNull();
  });
});

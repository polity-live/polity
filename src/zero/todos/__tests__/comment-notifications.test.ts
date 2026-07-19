import { describe, expect, it } from 'vitest';
import { collectTodoCommentRecipientIds } from '../comment-notifications';

describe('collectTodoCommentRecipientIds', () => {
  it('deduplicates creator and assignees and excludes the sender', () => {
    expect(
      collectTodoCommentRecipientIds(
        'creator',
        ['assignee', 'creator', 'assignee', 'sender'],
        'sender'
      )
    ).toEqual(['creator', 'assignee']);
  });
});

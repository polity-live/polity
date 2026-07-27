import { describe, expect, it } from 'vitest';
import { assertDocumentSuggestionIntegrity } from '../document-integrity';

const discussions = [{ id: 'suggestion-1' }];
const content = [
  {
    type: 'p',
    children: [
      {
        text: 'Neu',
        suggestion: true,
        suggestion_suggestion_1: {
          id: 'suggestion-1',
          type: 'insert',
        },
      },
    ],
  },
];

describe('document change request integrity', () => {
  it('returns a concrete snapshot for a linked suggestion', () => {
    expect(
      assertDocumentSuggestionIntegrity({
        changeRequestId: 'change-request-1',
        discussionId: 'suggestion-1',
        discussions,
        content,
      })
    ).toEqual(expect.objectContaining({ change_type: 'insert', new_text: 'Neu' }));
  });

  it('rejects a change request when its suggestion marker is missing', () => {
    expect(() =>
      assertDocumentSuggestionIntegrity({
        changeRequestId: 'change-request-1',
        discussionId: 'suggestion-1',
        discussions,
        content: [{ type: 'p', children: [{ text: 'Ohne Marker' }] }],
      })
    ).toThrow('linked suggestion is not present in the document');
  });

  it('rejects a discussion from another document scope', () => {
    expect(() =>
      assertDocumentSuggestionIntegrity({
        changeRequestId: 'change-request-1',
        discussionId: 'suggestion-2',
        discussions,
        content,
      })
    ).toThrow('linked discussion is not present in the document scope');
  });
});

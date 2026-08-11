import { describe, expect, it, vi } from 'vitest';
import {
  assertDocumentSuggestionIntegrity,
  assertPersistedDocumentChangeRequestIntegrity,
  isCityDesignChangeRequestSource,
} from '../document-integrity';

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

  it('recognizes normalized city-design source types', () => {
    expect(isCityDesignChangeRequestSource('  CITY_DESIGN_OBJECT ')).toBe(true);
    expect(isCityDesignChangeRequestSource('document')).toBe(false);
    expect(isCityDesignChangeRequestSource(null)).toBe(false);
  });

  it('rejects absent discussions, malformed discussion collections, and missing content', () => {
    for (const invalidDiscussions of [null, {}, [null, 'x', [], { id: 'other' }]]) {
      expect(() =>
        assertDocumentSuggestionIntegrity({
          changeRequestId: 'change-request-1',
          discussionId: invalidDiscussions === null ? null : 'suggestion-1',
          discussions: invalidDiscussions,
          content,
        })
      ).toThrow('linked discussion is not present');
    }
    expect(() =>
      assertDocumentSuggestionIntegrity({
        changeRequestId: 'change-request-1',
        discussionId: 'suggestion-1',
        discussions,
        content: null,
      })
    ).toThrow('document content not found');
  });

  it('validates a persisted amendment document without a process branch', async () => {
    const tx = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'amendment',
          document_id: 'document',
          discussions,
        })
        .mockResolvedValueOnce({ id: 'document', content }),
    };

    await expect(
      assertPersistedDocumentChangeRequestIntegrity({
        tx: tx as never,
        amendmentId: 'amendment',
        changeRequestId: 'change-request',
        discussionId: 'suggestion-1',
      })
    ).resolves.toMatchObject({ change_type: 'insert' });
  });

  it('rejects missing amendments and missing requested process branches', async () => {
    await expect(
      assertPersistedDocumentChangeRequestIntegrity({
        tx: { run: vi.fn().mockResolvedValueOnce(null) } as never,
        amendmentId: 'missing',
        changeRequestId: 'change-request',
      })
    ).rejects.toThrow('Amendment not found');

    await expect(
      assertPersistedDocumentChangeRequestIntegrity({
        tx: {
          run: vi.fn().mockResolvedValueOnce({ id: 'amendment' }).mockResolvedValueOnce(null),
        } as never,
        amendmentId: 'amendment',
        processBranchId: 'missing-branch',
        changeRequestId: 'change-request',
      })
    ).rejects.toThrow('process branch not found');
  });

  it('rejects process branches from another amendment or missing process runs', async () => {
    for (const processRun of [null, { amendment_id: 'other-amendment' }]) {
      const tx = {
        run: vi
          .fn()
          .mockResolvedValueOnce({ id: 'amendment' })
          .mockResolvedValueOnce({ id: 'branch', process_run_id: 'run' })
          .mockResolvedValueOnce(processRun),
      };
      await expect(
        assertPersistedDocumentChangeRequestIntegrity({
          tx: tx as never,
          amendmentId: 'amendment',
          processBranchId: 'branch',
          changeRequestId: 'change-request',
        })
      ).rejects.toThrow('does not belong to the amendment');
    }
  });

  it('uses branch document, discussions, and process-run ownership', async () => {
    const tx = {
      run: vi
        .fn()
        .mockResolvedValueOnce({ id: 'amendment', document_id: 'amendment-document' })
        .mockResolvedValueOnce({
          id: 'branch',
          process_run_id: 'run',
          document_id: 'branch-document',
          discussions,
        })
        .mockResolvedValueOnce({ id: 'run', amendment_id: 'amendment' })
        .mockResolvedValueOnce({ id: 'branch-document', content }),
    };

    await expect(
      assertPersistedDocumentChangeRequestIntegrity({
        tx: tx as never,
        amendmentId: 'amendment',
        processBranchId: 'branch',
        changeRequestId: 'change-request',
        discussionId: 'suggestion-1',
      })
    ).resolves.toMatchObject({ change_type: 'insert' });
  });

  it('rejects an absent effective document', async () => {
    await expect(
      assertPersistedDocumentChangeRequestIntegrity({
        tx: {
          run: vi.fn().mockResolvedValueOnce({
            id: 'amendment',
            document_id: null,
            discussions,
          }),
        } as never,
        amendmentId: 'amendment',
        changeRequestId: 'change-request',
        discussionId: 'suggestion-1',
      })
    ).rejects.toThrow('document content not found');
  });
});

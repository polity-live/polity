import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBranchDocumentArtifacts } from '../process-branch-document-artifacts';

function createTx(runResults: unknown[]) {
  const queue = [...runResults];
  return {
    run: vi.fn(async () => queue.shift()),
    mutate: {
      document_version: { insert: vi.fn(async () => null) },
      document: { insert: vi.fn(async () => null) },
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('process branch document artifacts', () => {
  it('reuses the first usable snapshot from an existing process run', async () => {
    const tx = createTx([
      [
        { id: 'branch-without-version', document_version_id: null },
        { id: 'branch-empty-version', document_version_id: 'version-empty' },
        { id: 'branch-base', document_version_id: 'version-base' },
      ],
      { id: 'version-empty', content: null },
      { id: 'version-base', content: [{ type: 'p', children: [{ text: 'Base' }] }] },
    ]);

    await expect(
      createBranchDocumentArtifacts(tx as never, {
        amendmentId: 'amendment-1',
        processRunId: 'run-1',
        authorId: 'user-1',
        changeSummary: 'New branch',
      })
    ).resolves.toMatchObject({
      documentVersionId: 'version-base',
      documentId: expect.any(String),
      editingMode: null,
    });

    expect(tx.mutate.document_version.insert).not.toHaveBeenCalled();
    expect(tx.mutate.document.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amendment_id: 'amendment-1',
        content: [{ type: 'p', children: [{ text: 'Base' }] }],
        editing_mode: 'edit',
      })
    );
  });

  it.each([
    {
      name: 'amendment query returns a collection',
      runResults: [[]],
    },
    {
      name: 'amendment has no canonical document',
      runResults: [{ id: 'amendment-1', document_id: null }],
    },
    {
      name: 'canonical document has no content',
      runResults: [
        { id: 'amendment-1', document_id: 'document-1' },
        { id: 'document-1', content: null },
      ],
    },
  ])('returns no artifacts when the $name', async ({ runResults }) => {
    const tx = createTx(runResults);

    await expect(
      createBranchDocumentArtifacts(tx as never, {
        amendmentId: 'amendment-1',
        authorId: 'user-1',
        changeSummary: 'New branch',
      })
    ).resolves.toEqual({ documentVersionId: null, documentId: null, editingMode: null });

    expect(tx.mutate.document_version.insert).not.toHaveBeenCalled();
    expect(tx.mutate.document.insert).not.toHaveBeenCalled();
  });

  it('falls back to the canonical document when an existing run has no usable snapshot', async () => {
    const tx = createTx([[], { id: 'amendment-1', document_id: null }]);

    await expect(
      createBranchDocumentArtifacts(tx as never, {
        amendmentId: 'amendment-1',
        processRunId: 'run-without-snapshot',
        authorId: 'user-1',
        changeSummary: 'New branch',
      })
    ).resolves.toEqual({ documentVersionId: null, documentId: null, editingMode: null });
  });

  it('creates a baseline version and branch document from the canonical document', async () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('30000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce('30000000-0000-4000-8000-000000000002');
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const content = [{ type: 'p', children: [{ text: 'Canonical' }] }];
    const tx = createTx([
      { id: 'amendment-1', document_id: 'document-1' },
      { id: 'document-1', content, editing_mode: 'view' },
      null,
    ]);

    await expect(
      createBranchDocumentArtifacts(tx as never, {
        amendmentId: 'amendment-1',
        processRunId: null,
        authorId: 'user-1',
        changeSummary: 'Initial branch',
      })
    ).resolves.toEqual({
      documentVersionId: '30000000-0000-4000-8000-000000000001',
      documentId: '30000000-0000-4000-8000-000000000002',
      editingMode: 'view',
    });

    expect(tx.mutate.document_version.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '30000000-0000-4000-8000-000000000001',
        document_id: 'document-1',
        version_number: 1,
        content,
      })
    );
    expect(tx.mutate.document.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '30000000-0000-4000-8000-000000000002',
        editing_mode: 'view',
        content,
      })
    );
  });

  it('defaults a missing canonical editing mode and increments the latest version', async () => {
    const tx = createTx([
      { id: 'amendment-1', document_id: 'document-1' },
      { id: 'document-1', content: [{ type: 'p', children: [] }] },
      { version_number: 4 },
    ]);

    await expect(
      createBranchDocumentArtifacts(tx as never, {
        amendmentId: 'amendment-1',
        authorId: 'user-1',
        changeSummary: 'Initial branch',
      })
    ).resolves.toMatchObject({ editingMode: null });

    expect(tx.mutate.document_version.insert).toHaveBeenCalledWith(
      expect.objectContaining({ version_number: 5 })
    );
    expect(tx.mutate.document.insert).toHaveBeenCalledWith(
      expect.objectContaining({ editing_mode: 'edit' })
    );
  });
});

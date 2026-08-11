import { describe, expect, it } from 'vitest';

import {
  buildCollaboratorOptions,
  buildDocumentPqlFields,
  getCollaboratorLabel,
  getDocumentSearchValues,
  sortDocuments,
} from '../groupDocumentsList';

describe('groupDocumentsList', () => {
  it('normalizes every collaborator label fallback', () => {
    expect(getCollaboratorLabel(null)).toBeNull();
    expect(getCollaboratorLabel({ id: '' })).toBeNull();
    expect(getCollaboratorLabel({ id: 'full', first_name: 'Ada', last_name: 'Lovelace' })).toBe(
      'Ada Lovelace'
    );
    expect(getCollaboratorLabel({ id: 'handle', handle: 'ada' })).toBe('ada');
    expect(getCollaboratorLabel({ id: 'email', email: 'ada@example.test' })).toBe(
      'ada@example.test'
    );
    expect(getCollaboratorLabel({ id: 'id-only' })).toBe('id-only');
  });

  it('deduplicates and sorts collaborator options with searchable keywords', () => {
    const options = buildCollaboratorOptions([
      { id: 'empty', created_at: 0, updated_at: 0, collaborators: null },
      {
        id: 'one',
        created_at: 1,
        updated_at: 2,
        collaborators: [
          { user: null },
          { user: { id: '' } },
          { user: { id: 'z', handle: 'Zulu', email: 'z@example.test' } },
          { user: { id: 'a', first_name: 'Alpha' } },
        ],
      },
      {
        id: 'duplicate',
        created_at: 2,
        updated_at: 3,
        collaborators: [{ user: { id: 'z', handle: 'Zulu updated' } }],
      },
    ]);

    expect(options).toEqual([
      { value: 'a', label: 'Alpha', keywords: [] },
      { value: 'z', label: 'Zulu updated', keywords: ['Zulu updated'] },
    ]);
  });

  it('builds field contracts and extracts empty and populated values', () => {
    const options = [{ value: 'user', label: 'User', keywords: [] }];
    const fields = buildDocumentPqlFields(options, {
      title: 'Title',
      collaborator: 'Collaborator',
      updated: 'Updated',
      created: 'Created',
    });
    const byKey = Object.fromEntries(fields.map(field => [field.key, field])) as Record<
      string,
      any
    >;
    const populated = {
      id: 'doc',
      title: 'Document',
      updated_at: 20,
      created_at: 10,
      collaborators: [{ user: { id: 'user' } }, { user: null }],
    };
    const empty = { id: 'empty', title: null, updated_at: 0, created_at: 0 };

    expect(byKey.title.getValue(populated)).toBe('Document');
    expect(byKey.title.getValue(empty)).toBe('');
    expect(byKey.collaborator_keys.options).toBe(options);
    expect(byKey.collaborator_keys.getValue(populated)).toEqual(['user']);
    expect(byKey.collaborator_keys.getValue(empty)).toEqual([]);
    expect(byKey.updated_at.getValue(populated)).toBe(20);
    expect(byKey.created_at.getValue(populated)).toBe(10);
  });

  it('builds search text and sorts by newest update first', () => {
    expect(
      getDocumentSearchValues({
        id: 'doc',
        title: 'Document',
        updated_at: 2,
        created_at: 1,
        collaborators: [{ user: { id: 'user', first_name: 'Ada' } }, { user: null }],
      })
    ).toEqual(['Document', 'Ada']);
    expect(
      getDocumentSearchValues({
        id: 'empty',
        title: null,
        updated_at: 0,
        created_at: 0,
      })
    ).toEqual([]);
    expect(
      sortDocuments([
        { id: 'old', updated_at: 1, created_at: 1 },
        { id: 'new', updated_at: 2, created_at: 1 },
      ]).map(document => document.id)
    ).toEqual(['new', 'old']);
  });
});

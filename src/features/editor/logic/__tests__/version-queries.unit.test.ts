import { describe, expect, it } from 'vitest';

import {
  buildVersionsQuery,
  buildVersionWhereClause,
  filterVersions,
  getMaxVersionNumber,
  getVersionEntityField,
  getVersionLinkName,
  sortVersionsDescending,
} from '../version-queries';

const documentEntityTypes = ['amendment', 'document', 'groupDocument', 'unknown'] as const;

describe('version query helpers', () => {
  it('maps blogs to their dedicated query and link fields', () => {
    expect(buildVersionWhereClause('blog', 'blog-1')).toEqual({ 'blog.id': 'blog-1' });
    expect(getVersionLinkName('blog')).toBe('blog');
    expect(getVersionEntityField('blog')).toBe('blogId');
    expect(buildVersionsQuery('blog', 'blog-1')).toEqual({
      documentVersions: {
        $: { where: { 'blog.id': 'blog-1' } },
        creator: {},
      },
    });
  });

  it.each(documentEntityTypes)('maps %s to document version fields', entityType => {
    const type = entityType as Parameters<typeof buildVersionWhereClause>[0];
    expect(buildVersionWhereClause(type, 'document-1')).toEqual({
      'document.id': 'document-1',
    });
    expect(getVersionLinkName(type)).toBe('document');
    expect(getVersionEntityField(type)).toBe('documentId');
  });

  it('returns zero for no versions and otherwise finds the maximum', () => {
    expect(getMaxVersionNumber([])).toBe(0);
    expect(
      getMaxVersionNumber([{ versionNumber: 2 }, { versionNumber: 9 }, { versionNumber: 4 }])
    ).toBe(9);
  });

  it('sorts newest first without mutating the input', () => {
    const versions = [
      { id: 'old', versionNumber: 1 },
      { id: 'new', versionNumber: 3 },
      { id: 'middle', versionNumber: 2 },
    ];

    expect(sortVersionsDescending(versions).map(version => version.id)).toEqual([
      'new',
      'middle',
      'old',
    ]);
    expect(versions.map(version => version.id)).toEqual(['old', 'new', 'middle']);
  });

  it('returns the original collection for an empty search', () => {
    const versions = [{ title: 'Budget', versionNumber: 2 }];
    expect(filterVersions(versions, '  ')).toBe(versions);
  });

  it('matches title, version number and creator case-insensitively', () => {
    const versions = [
      { title: 'Climate Budget', versionNumber: 2, creator: { name: 'Ada' } },
      { title: 'Mobility', versionNumber: 12, creator: { name: 'Grace Hopper' } },
      { title: 'Housing', versionNumber: 3 },
      { title: 'Health', versionNumber: 4, creator: {} },
    ];

    expect(filterVersions(versions, 'CLIMATE')).toEqual([versions[0]]);
    expect(filterVersions(versions, '12')).toEqual([versions[1]]);
    expect(filterVersions(versions, 'hopper')).toEqual([versions[1]]);
    expect(filterVersions(versions, 'missing')).toEqual([]);
  });
});

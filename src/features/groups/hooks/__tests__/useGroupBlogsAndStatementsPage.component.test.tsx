/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ blogs: undefined as any, statements: undefined as any }));
vi.mock('@/zero/blogs/useBlogState', () => ({
  useBlogState: () => ({ blogsByGroup: mocks.blogs }),
}));
vi.mock('@/zero/statements/useStatementState', () => ({
  useStatementState: () => ({ statementsByGroup: mocks.statements }),
}));

import { useGroupBlogsAndStatementsPage } from '../useGroupBlogsAndStatementsPage';

beforeEach(() => {
  mocks.blogs = undefined;
  mocks.statements = undefined;
});

describe('useGroupBlogsAndStatementsPage', () => {
  it('normalizes absent collections and changes filters', () => {
    const { result } = renderHook(() => useGroupBlogsAndStatementsPage({ groupId: 'g' }));
    expect(result.current.blogs).toEqual([]);
    expect(result.current.statements).toEqual([]);
    act(() => result.current.setFilter('blogs'));
    expect(result.current.filter).toBe('blogs');
  });

  it('searches blog title/description and statement text with null-safe fields', () => {
    mocks.blogs = [
      { id: 'title', title: 'Alpha', description: null },
      { id: 'description', title: null, description: 'Beta' },
      { id: 'none', title: null, description: null },
    ];
    mocks.statements = [
      { id: 'match', text: 'Alpha statement' },
      { id: 'none', text: null },
    ];
    const { result } = renderHook(() => useGroupBlogsAndStatementsPage({ groupId: 'g' }));
    expect(result.current.blogs).toHaveLength(3);
    expect(result.current.statements).toHaveLength(2);
    act(() => result.current.setSearchQuery('alpha'));
    expect(result.current.blogs.map((item: any) => item.id)).toEqual(['title']);
    expect(result.current.statements.map((item: any) => item.id)).toEqual(['match']);
    act(() => result.current.setSearchQuery('beta'));
    expect(result.current.blogs.map((item: any) => item.id)).toEqual(['description']);
  });
});

/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) => `translated:${key}`,
    tArray: (key: string) => [`array:${key}:1`, `array:${key}:2`],
  }),
}));

import { useDocsLandingPage, useDocsTopicPage } from '../useDocsPage';

describe('docs page models', () => {
  it('groups every topic by category and exposes the featured subset', () => {
    const { result } = renderHook(() => useDocsLandingPage());

    expect(result.current.categorySections.map(section => section.category)).toEqual([
      'people',
      'collaboration',
      'governance',
      'coordination',
      'systems',
    ]);
    expect(
      result.current.categorySections.every(section => section.title.startsWith('translated:'))
    ).toBe(true);
    expect(
      result.current.categorySections.flatMap(section => section.topics).length
    ).toBeGreaterThan(20);
    expect(result.current.featuredTopics.every(topic => topic.featured)).toBe(true);
  });

  it('resolves translations, arrays, and related definitions for a topic', () => {
    const { result } = renderHook(() => useDocsTopicPage('groups'));

    expect(result.current.topic.slug).toBe('groups');
    expect(result.current.baseKey).toBe('pages.docs.topics.groups');
    expect(result.current.title).toBe('translated:pages.docs.topics.groups.title');
    expect(result.current.actions).toEqual([
      'array:pages.docs.topics.groups.actions:1',
      'array:pages.docs.topics.groups.actions:2',
    ]);
    expect(result.current.relatedTopics.map(topic => topic.slug)).toEqual([
      'users',
      'events',
      'roles-and-rights',
    ]);
  });
});

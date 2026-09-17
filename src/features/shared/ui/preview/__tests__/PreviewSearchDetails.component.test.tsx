/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { PreviewSearchDetails } from '../PreviewSearchDetails';

const state = vi.hoisted(() => ({ document: undefined as any, query: vi.fn() }));
vi.mock('@rocicorp/zero/react', () => ({ useQuery: () => [state.document] }));
vi.mock('@/zero/queries', () => ({ queries: { search: { searchDocumentById: state.query } } }));
afterEach(cleanup);
beforeEach(() => {
  useLanguageStore.setState({ language: 'en' });
  state.query.mockClear();
  state.document = {
    visibility: 'public',
    group: { id: 'group-one', name: 'Neighborhood council' },
    topics: [{ topic: 'climate' }],
    card_payload: {
      status: 'edit',
      tags: ['climate', 'transport'],
      stats: { collaborators: 3, comments: 0, supporting_groups: 2, internal: 42 },
    },
  };
});

describe('search preview details', () => {
  it('shows the amendment status, source group, deduplicated topics and localized counts', () => {
    render(<PreviewSearchDetails target={{ kind: 'amendment', id: 'one' }} />);
    expect(state.query).toHaveBeenCalledWith({ id: 'amendment:one' });
    expect(screen.getByText('Collaborative Editing')).toBeTruthy();
    expect(screen.getByText('Neighborhood council')).toBeTruthy();
    expect(screen.getAllByText('#climate')).toHaveLength(1);
    expect(screen.getByText('#transport')).toBeTruthy();
    expect(screen.getByText('Collaborators').nextElementSibling?.textContent).toBe('3');
    expect(screen.getByText('Comments').nextElementSibling?.textContent).toBe('0');
    expect(screen.queryByText('42')).toBeNull();
  });

  it('uses German labels and event counts without inventing an amendment status', () => {
    useLanguageStore.setState({ language: 'de' });
    state.document.card_payload = { status: 'open', stats: { participants: 12, elections: 1 } };
    render(<PreviewSearchDetails target={{ kind: 'event', id: 'two' }} />);
    expect(screen.getByText('Teilnehmer').nextElementSibling?.textContent).toBe('12');
    expect(screen.getByText('Wahlen').nextElementSibling?.textContent).toBe('1');
    expect(screen.queryByText('open')).toBeNull();
  });

  it('does not expose missing or inaccessible projection details', () => {
    state.document = undefined;
    const { container } = render(<PreviewSearchDetails target={{ kind: 'todo', id: 'three' }} />);
    expect(container.textContent).toBe('');
  });
});

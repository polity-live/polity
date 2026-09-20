/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const presentation = vi.hoisted(() => ({ value: null as null | { view: string } }));
vi.mock('@/features/shared/ui/collections/CollectionScope', () => ({
  useCollectionPresentation: () => presentation.value,
}));
afterEach(() => {
  cleanup();
  presentation.value = null;
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { GroupDocumentCard } from '../GroupDocumentCard';

describe('GroupDocumentCard', () => {
  it('keeps metadata and the real document link in compact presentation including an untitled empty document', () => {
    presentation.value = { view: 'compact' };
    const view = render(
      <GroupDocumentCard
        document={{
          id: 'doc-1',
          title: 'Council notes',
          created_at: 1,
          updated_at: 2,
          collaborators: [{ id: 'c1' }],
        }}
        href="/group/g/editor/doc-1"
      />
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/group/g/editor/doc-1');
    expect(view.container.textContent).toContain('Council notes');
    view.rerender(<GroupDocumentCard document={{ id: 'empty', created_at: 1, updated_at: 0 }} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(view.container.textContent).toContain('0');
  });
  it('renders the card as a real link when href is provided', () => {
    render(
      <GroupDocumentCard
        href="/group/group-1/editor/doc-1"
        document={{
          id: 'doc-1',
          title: 'Document One',
          created_at: 1,
          updated_at: 2,
          collaborators: [],
        }}
      />
    );

    const link = screen.getByRole('link', { name: /document one/i });
    expect(link.getAttribute('href')).toBe('/group/group-1/editor/doc-1');
    expect(link.getAttribute('data-action-id')).toBe('documents.card.open');
    link.focus();
    expect(document.activeElement).toBe(link);
  });
});

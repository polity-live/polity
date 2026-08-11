/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => (key.includes('unknown') ? 'Unknown user' : key),
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { AmendmentMetadata } from '../AmendmentMetadata';
import { BlogMetadata } from '../BlogMetadata';
import { DocumentMetadata } from '../DocumentMetadata';

afterEach(cleanup);

describe('editor metadata contracts', () => {
  it('renders amendment badges and collaborator fallback, role, and visibility branches', () => {
    const { rerender } = render(
      <AmendmentMetadata
        code="A-42"
        status="draft"
        collaborators={[
          { id: 'one', user: { id: 'ada', name: 'Ada', avatar: '/ada.png' }, status: 'member' },
          { id: 'two', user: { id: 'unknown' }, status: 'owner' },
        ]}
      />
    );
    expect(screen.getByText('A-42')).toBeTruthy();
    expect(screen.getByText('draft')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('Unknown user')).toBeTruthy();
    expect(screen.getByText('owner')).toBeTruthy();

    rerender(<AmendmentMetadata showCollaborators={false} collaborators={[]} />);
    expect(screen.queryByText('features.editor.metadata.collaborators')).toBeNull();
  });

  it('renders public, authenticated, and private blog metadata with owner and hidden-list states', () => {
    const bloggers = [
      { id: 'one', user: { id: 'ada', name: 'Ada' }, status: 'owner' },
      { id: 'two', user: { id: 'unknown' }, status: 'member' },
    ];
    const { rerender } = render(
      <BlogMetadata date="2026-08-02" upvotes={0} visibility="public" bloggers={bloggers} />
    );
    expect(screen.getByText('features.editor.metadata.public')).toBeTruthy();
    expect(screen.getByText('features.editor.metadata.owner')).toBeTruthy();
    expect(screen.getByText('Unknown user')).toBeTruthy();
    expect(screen.getByText(/2026-08-02/)).toBeTruthy();

    rerender(<BlogMetadata visibility="authenticated" showBloggers={false} bloggers={bloggers} />);
    expect(screen.getByText('features.editor.metadata.authenticated')).toBeTruthy();
    expect(screen.queryByText('Ada')).toBeNull();

    rerender(<BlogMetadata visibility="private" />);
    expect(screen.getByText('features.editor.metadata.private')).toBeTruthy();
  });

  it('renders document owner, date, visibility, editable collaborator, and empty states', () => {
    const collaborators = [
      { id: 'one', user: { id: 'ada', name: 'Ada', avatar: '/ada.png' }, canEdit: true },
      { id: 'two', user: { id: 'unknown' }, canEdit: false },
    ];
    const { rerender } = render(
      <DocumentMetadata
        owner={{ id: 'owner', name: 'Grace' }}
        visibility="public"
        updatedAt={Date.UTC(2026, 7, 2, 12)}
        collaborators={collaborators}
        groupName="Civic Lab"
      />
    );
    expect(screen.getByText('Civic Lab')).toBeTruthy();
    expect(screen.getByText('features.editor.metadata.public')).toBeTruthy();
    expect(screen.getByText('Grace')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('Unknown user')).toBeTruthy();
    expect(screen.getByText('features.editor.metadata.canEdit')).toBeTruthy();

    rerender(<DocumentMetadata visibility="authenticated" showCollaborators={false} />);
    expect(screen.getByText('features.editor.metadata.authenticated')).toBeTruthy();
    rerender(<DocumentMetadata visibility="private" owner={{ id: 'unknown' }} />);
    expect(screen.getByText('features.editor.metadata.private')).toBeTruthy();
    expect(screen.getByText('Unknown user')).toBeTruthy();
  });
});

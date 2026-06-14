/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { GroupDocumentCard } from '../GroupDocumentCard';

describe('GroupDocumentCard', () => {
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

    expect(screen.getByRole('link', { name: /document one/i }).getAttribute('href')).toBe(
      '/group/group-1/editor/doc-1'
    );
  });
});

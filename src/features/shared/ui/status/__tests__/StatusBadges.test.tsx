/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CountBadge, EntityBadge, StatusBadge, VisibilityBadge } from '../StatusBadges';

describe('StatusBadges', () => {
  it('maps common statuses to badge text', () => {
    render(<StatusBadge status="approved">Approved</StatusBadge>);

    expect(screen.getByText('Approved')).toBeTruthy();
  });

  it('renders count and visibility badges through the shared status API', () => {
    render(
      <div>
        <CountBadge count={4} label="members" />
        <VisibilityBadge value="private">Private</VisibilityBadge>
      </div>
    );

    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('members')).toBeTruthy();
    expect(screen.getByText('Private')).toBeTruthy();
  });

  it('renders token-backed entity badges without changing the public badge API', () => {
    render(<EntityBadge entityType="blog">Blog</EntityBadge>);

    expect(screen.getByText('Blog').className).toContain('--entity-blog-bg');
  });
});

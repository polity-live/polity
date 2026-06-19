/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  BadgeControl,
  CountBadge,
  EntityBadge,
  StatusBadge,
  VisibilityBadge,
} from '../StatusBadges';
import { RightBadge } from '../RightVisuals';

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

  it('keeps BadgeControl tone hovers on their token colors', () => {
    render(
      <div>
        <BadgeControl tone="warning">Hybrid</BadgeControl>
        <BadgeControl tone="election">Listenwahl</BadgeControl>
        <BadgeControl tone="event">Target event</BadgeControl>
      </div>
    );

    const hybridBadge = screen.getByText('Hybrid');
    const electionBadge = screen.getByText('Listenwahl');
    const eventBadge = screen.getByText('Target event');

    expect(hybridBadge.className).toContain('hover:bg-[var(--badge-warning-bg)]');
    expect(hybridBadge.className).toContain('hover:text-[var(--badge-warning-fg)]');
    expect(hybridBadge.className).not.toContain('hover:bg-primary');

    expect(electionBadge.className).toContain('hover:bg-[var(--badge-accent-bg)]');
    expect(electionBadge.className).toContain('hover:text-[var(--badge-accent-fg)]');
    expect(electionBadge.className).not.toContain('hover:bg-primary');

    expect(eventBadge.className).toContain('hover:bg-[var(--entity-event-bg)]');
    expect(eventBadge.className).toContain('hover:text-[var(--entity-event-fg)]');
    expect(eventBadge.className).not.toContain('--badge-event');
  });

  it('keeps gradient right badges readable on hover like right filters', () => {
    render(<RightBadge right="amendmentRight" />);

    const badge = screen.getByText('Amendment');

    expect(badge.className).toContain('hover:bg-accent');
    expect(badge.className).toContain('hover:text-accent-foreground');
    expect(badge.className).not.toContain('hover:bg-primary');
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/theme', () => ({
  getEntityToneClasses: (tone: string) => ({
    gradient: `gradient-${tone}`,
    headerAccent: `header-${tone}`,
    text: `text-${tone}`,
  }),
}));

import { EntityPageShell } from '../EntityPageShell';

afterEach(cleanup);

describe('EntityPageShell', () => {
  it('renders the complete page shell including stats with and without units', () => {
    const { container } = render(
      <EntityPageShell
        entityType="event"
        title="Assembly"
        description="Annual gathering"
        eyebrow="Event"
        media={<div>Cover image</div>}
        actions={<button type="button">Edit</button>}
        badges={<span>Public</span>}
        metadata={<span>Berlin</span>}
        stats={[
          { label: 'Members', unit: 'people', value: 12 },
          { label: 'Votes', value: 4 },
        ]}
        tabs={<nav>Overview</nav>}
        feedback={<p>Saved</p>}
        className="shell-class"
        headerClassName="header-class"
        contentClassName="content-class"
      >
        <main>Content</main>
      </EntityPageShell>
    );

    for (const text of [
      'Assembly',
      'Annual gathering',
      'Event',
      'Cover image',
      'Edit',
      'Public',
      'Berlin',
      'Members',
      'people',
      'Votes',
      'Overview',
      'Saved',
      'Content',
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(container.querySelector('section')?.className).toContain('shell-class');
    expect(container.querySelector('header')?.className).toContain('header-class');
    expect(screen.getByText('Content').parentElement?.className).toContain('content-class');
    expect(container.querySelector('header')?.className).toContain('header-event');
  });

  it('omits every optional region for a bare shell', () => {
    const { container } = render(
      <EntityPageShell entityType="group" title="Bare group" stats={[]} />
    );
    expect(screen.getByText('Bare group')).toBeTruthy();
    expect(container.querySelector('dl')).toBeNull();
    expect(container.querySelector('header')?.textContent).toBe('Bare group');
    expect(container.querySelector('.gradient-group')).toBeTruthy();
  });

  it('renders badges without metadata', () => {
    render(<EntityPageShell entityType="user" title="User" badges={<span>Verified</span>} />);
    expect(screen.getByText('Verified')).toBeTruthy();
  });

  it('renders metadata without badges', () => {
    render(<EntityPageShell entityType="amendment" title="Proposal" metadata="Updated today" />);
    expect(screen.getByText('Updated today')).toBeTruthy();
  });
});

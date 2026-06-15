/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WikiIncumbentPanel } from '../WikiIncumbentPanel';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    params?: unknown;
    search?: unknown;
    to?: string;
  }) => {
    const anchorProps = { ...props };

    delete anchorProps.params;
    delete anchorProps.search;

    return (
      <a href={to ?? '#'} {...anchorProps}>
        {children}
      </a>
    );
  },
}));

vi.mock('embla-carousel-react', () => ({
  default: () => [
    () => undefined,
    {
      canScrollNext: () => false,
      canScrollPrev: () => false,
      off: () => undefined,
      on: () => undefined,
      scrollNext: () => undefined,
      scrollPrev: () => undefined,
    },
  ],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
}));

describe('WikiIncumbentPanel', () => {
  it('renders header cards and transparent carousel rows around incumbent cards', () => {
    const { container } = render(
      <WikiIncumbentPanel
        title="Roles & Incumbents"
        description="Assigned and elected roles with their active incumbents in this group"
        entityType="group"
        sections={[
          {
            id: 'leadership',
            title: 'Leadership',
            description: '3 active incumbents',
            cards: [
              {
                kind: 'person',
                id: 'person-card',
                userId: 'user-1',
                name: 'Ada Lovelace',
                handle: 'ada',
                avatar: null,
                roleId: 'role-admin',
                roleTitle: 'Admin',
                roleDescription: 'Can administer the group.',
              },
            ],
          },
          {
            id: 'low-count-roles',
            title: 'More roles & incumbents',
            description: 'Roles with fewer than 3 active incumbents, including vacant seats.',
            cards: [
              {
                kind: 'vacancy',
                id: 'vacancy-card',
                roleId: 'role-moderator',
                roleTitle: 'Moderator',
                roleDescription: null,
              },
            ],
          },
          {
            id: 'empty-section',
            title: 'Empty role',
            description: 'This section should not render.',
            cards: [],
          },
        ]}
      />
    );

    expect(screen.getByText('Roles & Incumbents')).toBeTruthy();
    expect(screen.getByText('More roles & incumbents')).toBeTruthy();
    expect(screen.queryByText('Empty role')).toBeNull();
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('Moderator')).toBeTruthy();

    const panel = container.querySelector('[data-slot="wiki-incumbent-panel"]');
    const headerCard = container.querySelector('[data-slot="wiki-incumbent-header-card"]');
    const sectionHeaderCards = container.querySelectorAll(
      '[data-slot="wiki-incumbent-section-header-card"]'
    );
    const carousels = container.querySelectorAll('[data-slot="wiki-incumbent-carousel"]');
    const incumbentCards = container.querySelectorAll('[data-slot="wiki-incumbent-card"]');
    const headerTitle = headerCard?.querySelector('h3');
    const firstSectionTitle = sectionHeaderCards[0]?.querySelector('h3');

    expect(panel?.tagName).toBe('SECTION');
    expect(panel?.className).not.toContain('bg-card');
    expect(panel?.className).not.toContain('shadow-[var(--shadow-panel)]');

    expect(headerCard?.className).toContain('bg-card');
    expect(headerCard?.className).not.toContain('border-l-4');
    expect(headerCard?.querySelector('svg')).toBeNull();
    expect(headerTitle?.className).toBe(firstSectionTitle?.className);
    expect(headerTitle?.className).toContain('text-lg');

    expect(sectionHeaderCards.length).toBe(2);
    expect(Array.from(sectionHeaderCards).every(card => card.className.includes('bg-card'))).toBe(
      true
    );
    expect(
      Array.from(sectionHeaderCards).every(card => !card.className.includes('border-l-4'))
    ).toBe(true);

    expect(carousels.length).toBe(2);
    expect(Array.from(carousels).every(carousel => !carousel.className.includes('bg-card'))).toBe(
      true
    );
    expect(Array.from(carousels).every(carousel => !carousel.className.includes('border'))).toBe(
      true
    );
    expect(Array.from(carousels).every(carousel => !carousel.className.includes('shadow'))).toBe(
      true
    );

    expect(incumbentCards.length).toBe(2);
    expect(Array.from(incumbentCards).every(card => card.className.includes('bg-card'))).toBe(true);
    expect(Array.from(incumbentCards).every(card => card.className.includes('rounded-lg'))).toBe(
      true
    );
    expect(Array.from(incumbentCards).every(card => card.className.includes('shadow-sm'))).toBe(
      true
    );
    expect(Array.from(incumbentCards).every(card => !card.className.includes('border-l-4'))).toBe(
      true
    );
    expect(
      Array.from(incumbentCards).every(card => !card.className.includes('--badge-neutral-bg'))
    ).toBe(true);
    expect(container.innerHTML).not.toContain('surface-overlay');
  });

  it('does not render when every section has no cards', () => {
    const { container } = render(
      <WikiIncumbentPanel
        title="Roles & Incumbents"
        description="Assigned and elected roles with their active incumbents in this group"
        sections={[
          {
            id: 'empty-section',
            title: 'Empty role',
            description: 'This section should not render.',
            cards: [],
          },
        ]}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});

/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/navigation/LinkSurface.tsx', () => ({
  LinkSurface: ({ children, href, containerClassName, ...props }: any) => (
    <a href={href} className={containerClassName} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import {
  TimelineCardActions,
  TimelineCardActionButton,
  TimelineCardBadge,
  TimelineCardBase,
  TimelineCardContent,
  TimelineCardHeader,
  TimelineCardStats,
} from '../TimelineCardBase';

const Icon = (props: any) => <svg data-testid="icon" {...props} />;

afterEach(cleanup);

describe('TimelineCardBase', () => {
  it('clips its colored sections to the rounded card boundary', () => {
    const { container } = render(
      <TimelineCardBase contentType="agenda_item">
        <TimelineCardHeader contentType="agenda_item" title="Public hearing scheduled" />
      </TimelineCardBase>
    );

    const card = container.firstElementChild;
    const classNames = card?.className.split(' ') ?? [];

    expect(classNames).toEqual(
      expect.arrayContaining(['rounded-2xl', 'overflow-hidden', 'border', 'flex'])
    );
  });

  it('dispatches pointer and supported keyboard activation only', () => {
    const onClick = vi.fn();
    const { container } = render(
      <TimelineCardBase contentType="event" elevated onClick={onClick} className="custom">
        Card
      </TimelineCardBase>
    );
    const card = container.firstElementChild!;
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'Escape' });
    expect(onClick).toHaveBeenCalledTimes(3);
    expect(card.getAttribute('role')).toBe('button');
    expect(card.className).toContain('cursor-pointer');
  });

  it('uses a link surface when href is provided', () => {
    render(
      <TimelineCardBase contentType="blog" href="/blog/blog-1">
        Linked card
      </TimelineCardBase>
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/blog/blog-1');
  });

  it('renders linked and plain header variants with optional icon and subtitle', () => {
    const { rerender } = render(
      <TimelineCardHeader
        contentType="event"
        title="Assembly"
        href="/event/event-1"
        subtitle="Group"
        subtitleHref="/group/group-1"
        badge={<span>Badge</span>}
      >
        Child
      </TimelineCardHeader>
    );
    expect(screen.getByRole('link', { name: 'Assembly' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Group' })).toBeTruthy();
    expect(screen.getByText('Badge')).toBeTruthy();
    expect(screen.getByText('Child')).toBeTruthy();

    rerender(
      <TimelineCardHeader contentType="event" title="Plain" subtitle="Subtitle" showIcon={false} />
    );
    expect(screen.getByText('Plain')).toBeTruthy();
    expect(screen.getByText('Subtitle').tagName).toBe('P');
  });

  it('renders content, actions, buttons, stats, and badges with optional icons', () => {
    const onClick = vi.fn();
    const { container } = render(
      <>
        <TimelineCardContent className="content-custom">Content</TimelineCardContent>
        <TimelineCardActions className="actions-custom">Actions</TimelineCardActions>
        <TimelineCardActionButton label="Default" onClick={onClick} />
        <TimelineCardActionButton
          label="Explicit"
          icon={Icon as any}
          variant="default"
          size="default"
          disabled
        />
        <TimelineCardStats
          stats={[
            { label: 'views', value: 2 },
            { icon: Icon as any, label: 'likes', value: 3 },
          ]}
          className="stats-custom"
        />
        <TimelineCardBadge label="Plain badge" />
        <TimelineCardBadge
          label="Icon badge"
          icon={Icon as any}
          variant="default"
          className="badge-custom"
        />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Default' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(container.querySelector('[data-timeline-card-content]')?.className).toContain(
      'content-custom'
    );
    expect(container.querySelector('[data-timeline-card-actions]')?.className).toContain(
      'actions-custom'
    );
    expect(screen.getAllByTestId('icon')).toHaveLength(3);
  });
});

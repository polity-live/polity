/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { Calendar, CheckCircle2, FileText, Vote } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';

import { CivicMotionTimeline } from '../CivicMotionTimeline';

afterEach(cleanup);

describe('CivicMotionTimeline', () => {
  it('renders icons for main timeline items and branches', () => {
    const { container } = render(
      <CivicMotionTimeline
        activeIndex={1}
        ariaLabel="Decision timeline"
        branchLabel="Result"
        branches={[
          {
            icon: CheckCircle2,
            id: 'accepted',
            isActive: true,
            label: 'Accepted',
          },
        ]}
        items={[
          { icon: FileText, id: 'draft', label: 'Draft' },
          { icon: Vote, id: 'vote', label: 'Vote' },
          { icon: Calendar, id: 'publish', label: 'Publish' },
        ]}
      />
    );

    expect(container.querySelectorAll('.civic-motion-timeline-dot svg')).toHaveLength(3);
    expect(container.querySelectorAll('.civic-motion-timeline-branch-dot svg')).toHaveLength(1);
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByText('Accepted')).toBeTruthy();
  });

  it('positions the marker on timeline node centers', () => {
    render(
      <CivicMotionTimeline
        activeIndex={1}
        ariaLabel="Decision timeline"
        items={[
          { icon: FileText, id: 'draft', label: 'Draft' },
          { icon: Vote, id: 'vote', label: 'Vote' },
          { icon: Calendar, id: 'publish', label: 'Publish' },
        ]}
      />
    );

    const timeline = screen.getByRole('group', { name: 'Decision timeline' });

    expect(timeline.style.getPropertyValue('--civic-motion-timeline-start-left')).toBe('16.666%');
    expect(timeline.style.getPropertyValue('--civic-motion-timeline-current-left')).toBe('50%');
    expect(timeline.style.getPropertyValue('--civic-motion-timeline-end-left')).toBe('83.333%');
  });

  it('renders nothing for an empty timeline', () => {
    const { container } = render(<CivicMotionTimeline items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('derives the active item and renders all optional item and branch copy', () => {
    const { container } = render(
      <CivicMotionTimeline
        compact
        className="timeline"
        items={[
          {
            description: 'Completed description',
            id: 'complete',
            isComplete: true,
            label: 'Complete',
            tone: 'success',
            value: 'Done',
          },
          { id: 'active', isActive: true, label: 'Active' },
        ]}
        branches={[
          {
            description: 'Branch description',
            id: 'branch',
            label: 'Branch',
            tone: 'warning',
            value: 'Branch value',
          },
        ]}
      />
    );

    expect(container.querySelector('.civic-motion-timeline')?.className).toContain(
      'civic-motion-timeline-compact'
    );
    expect(container.querySelector('.civic-motion-timeline')?.getAttribute('role')).toBeNull();
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('Completed description')).toBeTruthy();
    expect(screen.getByText('Branch value')).toBeTruthy();
    expect(screen.getByText('Branch description')).toBeTruthy();
    expect(container.querySelector('[data-tone="success"]')).toBeTruthy();
    expect(container.querySelector('[data-tone="warning"]')).toBeTruthy();
    expect(container.querySelector('.civic-motion-timeline-branch-label')).toBeNull();
  });

  it('falls back to the last complete item when no item is explicitly active', () => {
    const { container } = render(
      <CivicMotionTimeline
        activeIndex={-1}
        items={[
          { id: 'one', isComplete: true, label: 'One' },
          { id: 'two', label: 'Two' },
          { id: 'three', isComplete: true, label: 'Three' },
        ]}
      />
    );
    const items = container.querySelectorAll('.civic-motion-timeline-item');
    expect(items[2].className).toContain('item-active');
    expect(items[1].className).not.toContain('item-complete');
  });

  it('uses the first item when there are no completed or active items', () => {
    const { container } = render(<CivicMotionTimeline items={[{ id: 'only', label: 'Only' }]} />);
    expect(container.querySelector('.civic-motion-timeline-item')?.className).toContain(
      'item-active'
    );
    expect(container.querySelector('.civic-motion-timeline-rail')).toBeNull();
    expect(container.querySelector('[data-tone="neutral"]')).toBeTruthy();
  });

  it('bounds an explicit active index to the final item', () => {
    const { container } = render(
      <CivicMotionTimeline
        activeIndex={99}
        items={[
          { id: 'one', label: 'One' },
          { id: 'two', label: 'Two' },
        ]}
      />
    );
    expect(container.querySelectorAll('.civic-motion-timeline-item')[1].className).toContain(
      'item-active'
    );
  });
});

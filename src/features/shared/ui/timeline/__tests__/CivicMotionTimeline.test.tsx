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
});

/* @vitest-environment jsdom */

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  controller: vi.fn(() => ({ label: 'reason' })),
  view: vi.fn(() => null),
}));
vi.mock('@/features/timeline/hooks/useReasonTooltipController', () => ({
  useReasonTooltipController: mocks.controller,
}));
vi.mock('../ReasonTooltipView', () => ({ ReasonTooltipView: mocks.view }));
vi.mock('@/features/shared/ui/navigation/LinkSurface.tsx', () => ({
  LinkSurface: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { ReasonTooltip } from '../ReasonTooltip';
import { TimelineCardHeader } from '../TimelineCardBase';

describe('small timeline wrapper contracts', () => {
  it('connects reason tooltip context to its view', () => {
    expect(ReasonTooltip({ category: 'proximity', context: 'Nearby' } as any)).toBeTruthy();
    expect(mocks.controller).toHaveBeenCalledWith({ category: 'proximity', context: 'Nearby' });
  });

  it('stops card activation from both linked header labels', () => {
    const parentClick = vi.fn();
    const { getByText } = render(
      <div onClick={parentClick}>
        <TimelineCardHeader
          contentType="event"
          title="Title"
          href="/title"
          subtitle="Subtitle"
          subtitleHref="/subtitle"
        />
      </div>
    );
    fireEvent.click(getByText('Title'));
    fireEvent.click(getByText('Subtitle'));
    expect(parentClick).not.toHaveBeenCalled();
  });
});

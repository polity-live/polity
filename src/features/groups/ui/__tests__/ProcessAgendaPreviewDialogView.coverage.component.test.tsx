/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/features/agendas/ui/AgendaCard', () => ({
  AgendaCard: ({ title }: any) => <div>{title}</div>,
}));
vi.mock('@/features/agendas/ui/TimelineItem', () => ({
  TimelineItem: ({ children, startTime, endTime }: any) => (
    <div>
      {startTime}-{endTime}
      {children}
    </div>
  ),
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogHeader: ({ children }: any) => <header>{children}</header>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <header>{children}</header>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
}));

import {
  ProcessAgendaPreviewDialogView,
  processAgendaPreviewDialogViewInternals,
} from '../ProcessAgendaPreviewDialogView';
afterEach(cleanup);
const props = {
  open: true,
  onOpenChange: vi.fn(),
  amendmentId: 'a',
  amendmentTitle: 'A',
  processRunId: null,
  focusStepRunId: null,
  amendmentProcess: null,
  activeRun: null,
  activeBranch: null,
  resolvedAmendmentTitle: 'Amendment',
};
const item = (extra: any = {}) => ({
  id: 'i',
  title: 'Item',
  subtitle: 'Sub',
  detailsLink: '/i',
  type: 'amendment',
  status: 'pending',
  state: 'scheduled',
  order: 1,
  duration: 10,
  ...extra,
});

it('covers empty, scheduled, and unconfirmed previews plus time formats', () => {
  expect(processAgendaPreviewDialogViewInternals.formatTime()).toBe('--:--');
  expect(processAgendaPreviewDialogViewInternals.formatTime(null)).toBe('--:--');
  expect(processAgendaPreviewDialogViewInternals.formatTime(new Date(2026, 0, 1, 9))).not.toBe(
    '--:--'
  );
  expect(
    processAgendaPreviewDialogViewInternals.formatTime(new Date(2026, 0, 1, 10).getTime())
  ).not.toBe('--:--');
  const view = render(
    <ProcessAgendaPreviewDialogView
      {...props}
      previewItems={[]}
      scheduledItems={[]}
      scheduledButNotConfirmedItems={[]}
    />
  );
  view.rerender(
    <ProcessAgendaPreviewDialogView
      {...props}
      previewItems={[item()]}
      scheduledItems={[item()]}
      scheduledButNotConfirmedItems={[]}
    />
  );
  view.rerender(
    <ProcessAgendaPreviewDialogView
      {...props}
      previewItems={[item()]}
      scheduledItems={[]}
      scheduledButNotConfirmedItems={[item({ id: 'u', displayStartTime: 1, displayEndTime: 2 })]}
    />
  );
  expect(view.container.textContent).toContain('Item');
});

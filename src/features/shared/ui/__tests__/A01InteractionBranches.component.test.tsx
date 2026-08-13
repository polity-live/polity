/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (_key: string, _values?: unknown, fallback?: string) => fallback ?? _key,
  }),
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { ShareButtonView } from '@/features/shared/ui/action-buttons/ShareButtonView';
import { WeekViewDayHeaderButton } from '@/features/shared/ui/calendar/WeekViewControls';
import { CommentInputView } from '@/features/shared/ui/comments/CommentInputView';
import { VoteResultsDisplay } from '@/features/shared/ui/voting/VoteResultsDisplay';

describe('A01 interaction branches', () => {
  it('renders today and ordinary week headers when they are not selected', () => {
    const date = new Date(2026, 0, 2);
    const { rerender } = render(
      <WeekViewDayHeaderButton date={date} isToday locale="en" onDateSelect={vi.fn()} />
    );
    expect(screen.getByRole('button').className).toContain('bg-primary/10');
    rerender(<WeekViewDayHeaderButton date={date} locale="en" onDateSelect={vi.fn()} />);
    expect(screen.getByRole('button').className).toContain('bg-background/95');
  });

  it('renders both comment cancellation positions and the busy disabled state', () => {
    const onCancelReply = vi.fn();
    const props = {
      isBusy: true,
      onCancelReply,
      onKeyDown: vi.fn(),
      onSubmit: vi.fn(),
      placeholder: 'Comment',
      setText: vi.fn(),
      text: 'ready',
    };
    const { rerender } = render(<CommentInputView {...props} replyTo="Alice" />);
    expect(screen.getByText(/Alice/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '' }).hasAttribute('disabled')).toBe(true);

    rerender(<CommentInputView {...props} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy();
  });

  it('renders internal sharing with its fallback label and copied state', () => {
    const setConversationDialogOpen = vi.fn();
    const setIsOpen = vi.fn();
    render(
      <ShareButtonView
        className=""
        conversationDialogOpen={false}
        copied
        description="Description"
        directSharePlatforms={[]}
        encodedTitle="Title"
        encodedUrl="url"
        fullUrl="https://example.test/item"
        handleCopyUrl={vi.fn()}
        handleShare={vi.fn()}
        internalShareLabel={undefined}
        isOpen
        manualSharePlatforms={[]}
        renderConversationDialog={({ open }: { open: boolean }) => (
          <div data-testid="conversation">{String(open)}</div>
        )}
        setConversationDialogOpen={setConversationDialogOpen}
        setCopied={vi.fn()}
        setIsOpen={setIsOpen}
        shareContextItem={{}}
        sharePlatforms={[]}
        size="default"
        t={(key: string) => key}
        title="Title"
        url="/item"
        variant="outline"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /polity/i }));
    expect(setConversationDialogOpen).toHaveBeenCalledWith(true);
    expect(setIsOpen).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('conversation').textContent).toBe('false');
  });

  it('normalizes non-finite vote percentages and renders rich option content', () => {
    const { container } = render(
      <VoteResultsDisplay
        animate={false}
        compact={false}
        options={[
          {
            color: 'bg-green',
            description: 'Detailed choice',
            finalCount: 1,
            finalPercent: Number.NaN,
            icon: <span>Icon</span>,
            indicationCount: 0,
            indicationPercent: 0,
            key: 'choice',
            label: 'Choice',
            lightColor: 'bg-green/40',
          },
        ]}
        phase="final"
        totalFinal={1}
        totalIndication={0}
      />
    );
    expect(screen.getByText('Icon')).toBeTruthy();
    expect(screen.getByText('Detailed choice')).toBeTruthy();
    expect(
      container.querySelector('[data-slot="vote-result-bar"] div')?.getAttribute('style')
    ).toContain('0%');
  });
});

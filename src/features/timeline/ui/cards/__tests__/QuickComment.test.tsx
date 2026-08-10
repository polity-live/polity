/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommentPreview, QuickComment } from '../QuickComment';

afterEach(cleanup);

describe('QuickComment', () => {
  it('uses a compact borderless discussion action before opening its composer', () => {
    render(
      <QuickComment
        contentId="amendment-1"
        contentType="amendment"
        commentCount={3}
        placeholder="Join discussion"
      />
    );

    const trigger = screen.getByRole('button', { name: /join discussion/i });

    expect(trigger.getAttribute('data-slot')).toBe('discussion-action-bar');
    expect(trigger.className.split(/\s+/)).not.toContain('border');

    fireEvent.click(trigger);

    expect(screen.getByPlaceholderText('Join discussion')).toBeTruthy();
  });

  it('opens the compact composer and hides a zero comment count', () => {
    const { container } = render(
      <QuickComment contentId="event-1" contentType="event" compact className="custom" />
    );
    const trigger = screen.getByRole('button');
    expect(trigger.textContent).not.toContain('0');
    expect(trigger.className).toContain('custom');
    fireEvent.click(trigger);
    expect(container.querySelector('textarea')).toBeTruthy();

    cleanup();
    render(<QuickComment contentId="event-2" contentType="event" compact commentCount={2} />);
    expect(screen.getByRole('button').textContent).toContain('2');
  });

  it('keeps a non-empty comment on blur, trims it, and submits with Ctrl+Enter', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <QuickComment contentId="blog-1" contentType="blog" defaultExpanded onSubmit={onSubmit} />
    );
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '  useful comment  ' } });
    fireEvent.blur(textarea);
    expect(screen.getByRole('textbox')).toBeTruthy();
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('useful comment'));
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
  });

  it('submits without a callback through Meta+Enter', async () => {
    render(
      <QuickComment contentId="group-1" contentType="group" defaultExpanded placeholder="Write" />
    );
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'comment' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
  });

  it('blocks duplicate submissions while pending and restores the composer after failure', async () => {
    let rejectSubmission!: (error: Error) => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSubmission = reject;
        })
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <QuickComment
        contentId="statement-1"
        contentType="statement"
        defaultExpanded
        onSubmit={onSubmit}
      />
    );
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'retry me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledOnce();
    rejectSubmission(new Error('offline'));
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('retry me');
    consoleError.mockRestore();
  });

  it('handles ordinary keys, Escape cancellation, and empty blur collapse', () => {
    const onSubmit = vi.fn();
    render(
      <QuickComment contentId="event-1" contentType="event" defaultExpanded onSubmit={onSubmit} />
    );
    let textarea = screen.getByRole('textbox');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(textarea, { target: { value: 'draft' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();

    cleanup();
    render(<QuickComment contentId="event-2" contentType="event" defaultExpanded />);
    textarea = screen.getByRole('textbox');
    fireEvent.blur(textarea);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('renders comment previews, default limits, and the view-all action', () => {
    const comments = [
      { id: '1', author: 'Ada', content: 'One', createdAt: 1 },
      { id: '2', author: 'Lin', content: 'Two', createdAt: 2 },
      { id: '3', author: 'Sam', content: 'Three', createdAt: 3 },
    ];
    const onViewAll = vi.fn();
    const { rerender } = render(<CommentPreview comments={comments} onViewAll={onViewAll} />);
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('Lin')).toBeTruthy();
    expect(screen.queryByText('Sam')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(onViewAll).toHaveBeenCalledOnce();

    rerender(<CommentPreview comments={comments} maxComments={1} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('returns no preview for an empty list', () => {
    const { container } = render(<CommentPreview comments={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

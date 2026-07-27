/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiContextCards } from '../AiContextCards';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe('AiContextCards', () => {
  it('renders mixed entity results compactly and expands after four cards', () => {
    const attachments = [
      { entityType: 'group' as const, entityId: '1', title: 'Group result', href: '/group/1' },
      { entityType: 'event' as const, entityId: '2', title: 'Event result' },
      { entityType: 'user' as const, entityId: '3', title: 'User result' },
      { entityType: 'amendment' as const, entityId: '4', title: 'Amendment result' },
      { entityType: 'blog' as const, entityId: '5', title: 'Blog result' },
    ];

    render(<AiContextCards attachments={attachments} contextLabel="output" />);

    expect(screen.getByText('Amendment result')).toBeTruthy();
    expect(screen.queryByText('Blog result')).toBeNull();
    expect(screen.getByRole('link', { name: /Group result/ }).getAttribute('href')).toBe(
      '/group/1'
    );
    expect(screen.queryByRole('link', { name: /Event result/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /1|more|weitere/i }));
    expect(screen.getByText('Blog result')).toBeTruthy();
  });

  it('separates assistant output and update results into independent context sections', () => {
    const attachments = [
      ...Array.from({ length: 5 }, (_, index) => ({
        entityType: 'group' as const,
        entityId: `output-${index}`,
        title: `Output ${index + 1}`,
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        entityType: 'event' as const,
        entityId: `update-${index}`,
        title: `Update ${index + 1}`,
        context_type: 'update' as const,
      })),
    ];

    render(<AiContextCards attachments={attachments} contextLabel="output" />);

    const outputSection = screen.getByRole('region', { name: /output context/i });
    const updateSection = screen.getByRole('region', { name: /update/i });
    expect(within(outputSection).queryByText('Output 5')).toBeNull();
    expect(within(updateSection).queryByText('Update 5')).toBeNull();

    fireEvent.click(within(outputSection).getByRole('button'));
    expect(within(outputSection).getByText('Output 5')).toBeTruthy();
    expect(within(updateSection).queryByText('Update 5')).toBeNull();
  });

  it('treats every user attachment as input even when it carries update metadata', () => {
    render(
      <AiContextCards
        contextLabel="input"
        attachments={[
          {
            entityType: 'group',
            entityId: 'group-1',
            title: 'Previously updated group',
            context_type: 'update',
          },
        ]}
      />
    );

    expect(screen.getByRole('region', { name: /input context/i })).toBeTruthy();
    expect(screen.queryByRole('region', { name: /update/i })).toBeNull();
  });

  it('renders a persisted V1 output entity with its relative route', () => {
    render(
      <AiContextCards
        contextLabel="output"
        contextJson={JSON.stringify({
          version: 1,
          attachments: [
            {
              entityType: 'group',
              entityId: 'group-created',
              title: 'Created group',
              context_type: 'output',
              href: '/group/group-created',
            },
          ],
          presentations: [],
        })}
      />
    );

    expect(screen.getByRole('region', { name: /output context/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Created group/ }).getAttribute('href')).toBe(
      '/group/group-created'
    );
  });

  it('anchors only clickable todo cards in assistant output context', () => {
    const outputTodo = {
      entityType: 'todo' as const,
      entityId: 'todo-created',
      title: 'Created todo',
      context_type: 'output' as const,
      href: '/todos',
    };
    const { rerender } = render(
      <AiContextCards contextLabel="output" attachments={[outputTodo]} />
    );

    expect(
      screen.getByRole('link', { name: /Created todo/ }).getAttribute('data-tutorial-anchor')
    ).toBe('tutorial-assistant-todo-output');

    rerender(<AiContextCards contextLabel="input" attachments={[outputTodo]} />);
    expect(
      screen.getByRole('link', { name: /Created todo/ }).getAttribute('data-tutorial-anchor')
    ).toBeNull();

    rerender(
      <AiContextCards
        contextLabel="output"
        attachments={[{ ...outputTodo, context_type: 'update' }]}
      />
    );
    expect(
      screen.getByRole('link', { name: /Created todo/ }).getAttribute('data-tutorial-anchor')
    ).toBeNull();

    rerender(
      <AiContextCards
        contextLabel="output"
        attachments={[
          {
            entityType: 'group',
            entityId: 'group-created',
            title: 'Created group',
            href: '/group/group-created',
          },
        ]}
      />
    );
    expect(
      screen.getByRole('link', { name: /Created group/ }).getAttribute('data-tutorial-anchor')
    ).toBeNull();
  });
});

/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageContent } from '../MessageContent';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('../LinkPreview.tsx', () => ({
  LinkPreview: ({ url }: { url: string }) => <div data-testid="link-preview">{url}</div>,
}));

afterEach(cleanup);

describe('MessageContent Markdown', () => {
  it('renders safe GFM for assistant messages', () => {
    const { container } = render(
      <MessageContent
        renderMarkdown
        content={'**Bold**\n\n- Item\n\n`code`\n\n| A | B |\n| - | - |\n| 1 | 2 |'}
      />
    );

    expect(screen.getByText('Bold').tagName).toBe('STRONG');
    expect(screen.getByText('Item').closest('li')).toBeTruthy();
    expect(screen.getByText('code').tagName).toBe('CODE');
    expect(container.querySelector('table')).toBeTruthy();
  });

  it('uses internal navigation, secures external links, and blocks raw HTML protocols', () => {
    const { container } = render(
      <MessageContent
        renderMarkdown
        content={
          '[Group](/group/one) [External](https://example.com) <script>alert(1)</script> [Bad](javascript:alert(1))'
        }
      />
    );

    expect(screen.getByRole('link', { name: 'Group' }).getAttribute('href')).toBe('/group/one');
    expect(screen.getByRole('link', { name: 'Group' }).getAttribute('data-action-id')).toBe(
      'messages.content.markdown-internal.open'
    );
    const external = screen.getByRole('link', { name: 'External' });
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toBe('noopener noreferrer');
    expect(external.getAttribute('data-action-id')).toBe('messages.content.markdown-external.open');
    expect(container.querySelector('script')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Bad' })).toBeNull();
    expect(screen.getByText('Bad')).toBeTruthy();
  });

  it('keeps normal chat content as plain text', () => {
    render(<MessageContent content="**not bold**" />);
    expect(screen.getByText('**not bold**').tagName).toBe('SPAN');
  });

  it('hides Polity entity previews while preserving inline links and external previews', () => {
    render(
      <MessageContent content="See /group/group-1 and https://example.com" hidePolityLinkPreviews />
    );

    expect(screen.getByRole('link', { name: '/group/group-1' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'https://example.com' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: '/group/group-1' }).getAttribute('data-action-id')
    ).toBe('messages.content.plain-internal.open');
    expect(
      screen.getByRole('link', { name: 'https://example.com' }).getAttribute('data-action-id')
    ).toBe('messages.content.plain-external.open');
    expect(screen.getAllByTestId('link-preview')).toHaveLength(1);
    expect(screen.getByTestId('link-preview').textContent).toBe('https://example.com');
  });

  it('keeps Polity entity previews when preview suppression is disabled', () => {
    render(<MessageContent content="See /group/group-1 and https://example.com" />);

    expect(screen.getAllByTestId('link-preview')).toHaveLength(2);
  });

  it('blocks credential-bearing HTTP URLs in Markdown and link previews', () => {
    render(
      <MessageContent
        renderMarkdown
        content={
          '[Suspicious](https://polity@example.com/group/group-1) [Password](https://user:secret@example.com/private)'
        }
      />
    );

    expect(screen.queryByRole('link', { name: 'Suspicious' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Password' })).toBeNull();
    expect(screen.getByText('Suspicious').tagName).toBe('SPAN');
    expect(screen.getByText('Password').tagName).toBe('SPAN');
    expect(screen.queryByTestId('link-preview')).toBeNull();
  });

  it('renders a credential-bearing plain URL as text without a preview', () => {
    const suspiciousUrl = 'https://polity@example.com/group/group-1';
    render(<MessageContent content={suspiciousUrl} />);

    expect(screen.queryByRole('link', { name: suspiciousUrl })).toBeNull();
    expect(screen.getByText(suspiciousUrl).tagName).toBe('SPAN');
    expect(screen.queryByTestId('link-preview')).toBeNull();
  });
});

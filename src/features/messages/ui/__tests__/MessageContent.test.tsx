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
vi.mock('../LinkPreview.tsx', () => ({ LinkPreview: () => null }));

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
    const external = screen.getByRole('link', { name: 'External' });
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toBe('noopener noreferrer');
    expect(container.querySelector('script')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Bad' })).toBeNull();
    expect(screen.getByText('Bad')).toBeTruthy();
  });

  it('keeps normal chat content as plain text', () => {
    render(<MessageContent content="**not bold**" />);
    expect(screen.getByText('**not bold**').tagName).toBe('SPAN');
  });
});

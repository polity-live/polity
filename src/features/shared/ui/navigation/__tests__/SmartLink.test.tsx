/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a data-router-link="true" href={to} {...props}>
      {children}
    </a>
  ),
}));

import { isExternalHref, isPlainLeftClick, SmartLink, toRouterHref } from '../SmartLink';

describe('SmartLink', () => {
  it('routes root-relative app paths through TanStack Router', () => {
    render(<SmartLink href="/create/amendment">Create amendment</SmartLink>);

    const link = screen.getByRole('link', { name: 'Create amendment' });
    expect(link.getAttribute('data-router-link')).toBe('true');
    expect(link.getAttribute('href')).toBe('/create/amendment');
  });

  it('keeps query strings and hashes on router links', () => {
    render(<SmartLink href="/search?x=1#result">Search</SmartLink>);

    const link = screen.getByRole('link', { name: 'Search' });
    expect(link.getAttribute('data-router-link')).toBe('true');
    expect(link.getAttribute('href')).toBe('/search?x=1#result');
  });

  it('converts same-origin absolute URLs to router paths', () => {
    const href = `${window.location.origin}/create/blog-entry?groupId=group-1`;

    expect(toRouterHref(href)).toBe('/create/blog-entry?groupId=group-1');
    expect(isExternalHref(href)).toBe(false);

    render(<SmartLink href={href}>Create blog</SmartLink>);

    const link = screen.getByRole('link', { name: 'Create blog' });
    expect(link.getAttribute('data-router-link')).toBe('true');
    expect(link.getAttribute('href')).toBe('/create/blog-entry?groupId=group-1');
  });

  it('leaves external URLs as native anchors', () => {
    render(<SmartLink href="https://example.com/create/amendment">External</SmartLink>);

    const link = screen.getByRole('link', { name: 'External' });
    expect(link.getAttribute('data-router-link')).toBeNull();
    expect(link.getAttribute('href')).toBe('https://example.com/create/amendment');
    expect(isExternalHref('https://example.com/create/amendment')).toBe(true);
  });

  it('leaves non-route native hrefs as anchors', () => {
    render(
      <>
        <SmartLink href="mailto:support@example.com">Mail</SmartLink>
        <SmartLink href="#timeline-content">Skip</SmartLink>
        <SmartLink href="/download.csv" download>
          Download
        </SmartLink>
        <SmartLink href="/create/amendment" target="_blank">
          New tab
        </SmartLink>
      </>
    );

    expect(screen.getByRole('link', { name: 'Mail' }).getAttribute('data-router-link')).toBeNull();
    expect(screen.getByRole('link', { name: 'Skip' }).getAttribute('data-router-link')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Download' }).getAttribute('data-router-link')
    ).toBeNull();
    expect(
      screen.getByRole('link', { name: 'New tab' }).getAttribute('data-router-link')
    ).toBeNull();
    expect(screen.getByRole('link', { name: 'New tab' }).getAttribute('href')).toBe(
      '/create/amendment'
    );
  });

  it('uses router links for explicit self-targeted internal hrefs', () => {
    render(
      <SmartLink href="/create/group" target="_self">
        Same tab
      </SmartLink>
    );

    const link = screen.getByRole('link', { name: 'Same tab' });
    expect(link.getAttribute('data-router-link')).toBe('true');
    expect(link.getAttribute('href')).toBe('/create/group');
  });

  it('identifies plain left clicks separately from modified clicks', () => {
    expect(
      isPlainLeftClick({
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      })
    ).toBe(true);

    expect(
      isPlainLeftClick({
        button: 0,
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
      })
    ).toBe(false);
    expect(
      isPlainLeftClick({
        button: 1,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      })
    ).toBe(false);
  });
});

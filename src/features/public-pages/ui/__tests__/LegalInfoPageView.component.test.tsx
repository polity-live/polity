/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { LegalInfoPageView } from '../LegalInfoPageView';
import { SupportPageView } from '../SupportPageView';

afterEach(cleanup);

describe('legal info page view', () => {
  it('renders paragraph, list, empty-list, related-link, and custom-action states', () => {
    const { rerender } = render(
      <LegalInfoPageView
        title="Privacy"
        subtitle="How data is handled"
        lastUpdated="Updated August 2026"
        sections={[
          { key: 'collection', title: 'Collection', paragraphs: ['Only required data'], items: [] },
          {
            key: 'rights',
            title: 'Your rights',
            paragraphs: ['You stay in control'],
            items: ['Access', 'Deletion'],
          },
        ]}
        relatedTitle="Related policies"
        relatedDescription="Read more"
        relatedLinks={[
          { to: '/imprint', title: 'Imprint', description: 'Provider details' },
          { to: '/support', title: 'Support', description: 'Contact us' },
        ]}
        relatedActionLabel="Open policy"
      />
    );

    expect(screen.getByRole('heading', { name: 'Privacy' })).toBeTruthy();
    expect(screen.getByText('Only required data')).toBeTruthy();
    expect(screen.getByText('Access')).toBeTruthy();
    expect(screen.getByText('Deletion')).toBeTruthy();
    expect(
      screen.getAllByRole('link', { name: 'Open policy' }).map(link => link.getAttribute('href'))
    ).toEqual(['/imprint', '/support']);

    rerender(
      <LegalInfoPageView
        title="Imprint"
        subtitle="Provider"
        lastUpdated="Current"
        sections={[]}
        relatedTitle="Related"
        relatedDescription="More"
        relatedLinks={[{ to: '/privacy-policy', title: 'Privacy', description: 'Policy' }]}
      />
    );
    expect(screen.getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe(
      '/privacy-policy'
    );
    expect(
      document.querySelector('[data-action-id="public-pages.legal.related.open"]')
    ).toBeTruthy();
  });

  it('renders stable internal, external, and authentication support destinations', () => {
    const { container } = render(
      <SupportPageView
        title="Support"
        subtitle="Help build Polity"
        howCanHelp="Contribute"
        areas={[
          {
            key: 'design',
            title: 'Design',
            description: 'Improve UX',
            details: ['Review'],
            cta: 'Open design board',
            href: 'https://design.example.test',
            external: true,
            icon: 'design',
          },
          {
            key: 'development',
            title: 'Development',
            description: 'Write code',
            details: ['Test'],
            cta: 'Read docs',
            href: '/docs',
            icon: 'development',
          },
        ]}
        communityTitle="Join"
        communityDescription="Create an account"
        getStartedLabel="Get started"
      />
    );
    expect(
      container
        .querySelector('[data-action-id="public-pages.support-area.external.open"]')
        ?.getAttribute('href')
    ).toBe('https://design.example.test');
    expect(
      container
        .querySelector('[data-action-id="public-pages.support-area.internal.open"]')
        ?.getAttribute('href')
    ).toBe('/docs');
    expect(
      container
        .querySelector('[data-action-id="public-pages.support.auth.open"]')
        ?.getAttribute('href')
    ).toBe('/auth');
  });
});

/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key, tArray: () => [] }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../DeferredLandingPreview', () => ({
  DeferredLandingPreview: () => <div data-testid="deferred-preview" />,
}));
vi.mock('../ProductStoryPoint', () => ({ ProductStoryPoint: () => <div /> }));
vi.mock('@/features/shared/ui/PublicSiteFooter', () => ({ PublicSiteFooter: () => <footer /> }));

import { ContactLink, PublicLandingPage } from '../PublicLandingPage';

afterEach(cleanup);

describe('public landing contact links', () => {
  it('wires the complete imprint contact surface', () => {
    const { container } = render(<PublicLandingPage />);

    for (const id of [
      'public-landing.contact.email.open',
      'public-landing.contact.repository.open',
      'public-landing.contact.support.open',
    ]) {
      expect(container.querySelector(`[data-action-id="${id}"]`)).toBeTruthy();
    }
  });

  it('preserves stable email and external repository navigation contracts', () => {
    const { container } = render(
      <>
        <ContactLink
          data-action-id="public-landing.contact.email.open"
          href="mailto:support@polity.live"
          title="Email"
          value="support@polity.live"
          description="Contact support"
        />
        <ContactLink
          data-action-id="public-landing.contact.repository.open"
          href="https://github.com/polity-live/polity"
          title="Repository"
          value="GitHub"
          description="Open repository"
          external
        />
      </>
    );

    const email = container.querySelector<HTMLAnchorElement>(
      '[data-action-id="public-landing.contact.email.open"]'
    );
    const repository = container.querySelector<HTMLAnchorElement>(
      '[data-action-id="public-landing.contact.repository.open"]'
    );
    expect(email?.getAttribute('href')).toBe('mailto:support@polity.live');
    expect(repository?.getAttribute('href')).toBe('https://github.com/polity-live/polity');
    expect(repository?.target).toBe('_blank');
    expect(repository?.rel).toBe('noopener noreferrer');
    email!.focus();
    expect(document.activeElement).toBe(email);
  });
});

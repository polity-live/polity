/* @vitest-environment jsdom */

import type { ComponentType } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const routerMocks = vi.hoisted(() => ({
  notFound: vi.fn(() => ({ kind: 'not-found' as const })),
  params: { slug: 'deep-link-slug' },
  redirect: vi.fn((options: unknown) => ({ kind: 'redirect' as const, options })),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (path: string) => (options: TestRoute['options']) => ({
    options,
    path,
    useParams: () => routerMocks.params,
  }),
  notFound: routerMocks.notFound,
  Outlet: () => <div data-testid="router-outlet" />,
  redirect: routerMocks.redirect,
}));

vi.mock('@/features/auth/ui/AuthCallbackPage', () => ({
  AuthCallbackPage: () => <div data-testid="auth-callback-page" />,
}));
vi.mock('@/features/auth/ui/ForgotPasswordForm', () => ({
  ForgotPasswordForm: () => <div data-testid="forgot-password-form" />,
}));
vi.mock('@/features/auth/ui/ResetPasswordForm', () => ({
  ResetPasswordForm: () => <div data-testid="reset-password-form" />,
}));
vi.mock('@/features/auth/ui/SignInForm', () => ({
  SignInForm: () => <div data-testid="sign-in-form" />,
}));
vi.mock('@/features/auth/ui/SignUpForm', () => ({
  SignUpForm: () => <div data-testid="sign-up-form" />,
}));
vi.mock('@/features/auth/ui/VerifyForm', () => ({
  VerifyForm: () => <div data-testid="verify-form" />,
}));

vi.mock('@/features/docs/ui/DocsShell', () => ({
  DocsShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="docs-shell">{children}</div>
  ),
}));
vi.mock('@/features/docs/DocsLandingPage', () => ({
  DocsLandingPage: () => <div data-testid="docs-landing-page" />,
}));
vi.mock('@/features/docs/DocsContentPage', () => ({
  DocsContentPage: ({ kind, slug }: { kind: string; slug: string }) => (
    <div data-testid="docs-content-page">{`${kind}:${slug}`}</div>
  ),
}));

vi.mock('@/features/public-landing/ui/HomePageContainer', () => ({
  HomePageContainer: () => <div data-testid="home-page" />,
}));
vi.mock('@/features/payments/ui/PricingPageContainer', () => ({
  PricingPageContainer: () => <div data-testid="pricing-page" />,
}));
vi.mock('@/features/public-pages/ui/PrivacyPolicyPageContainer', () => ({
  PrivacyPolicyPageContainer: () => <div data-testid="privacy-policy-page" />,
}));
vi.mock('@/features/public-pages/ui/SupportPageContainer', () => ({
  SupportPageContainer: () => <div data-testid="support-page" />,
}));
vi.mock('@/features/public-pages/ui/TermsPageContainer', () => ({
  TermsPageContainer: () => <div data-testid="terms-page" />,
}));

import { Route as CatchAllRoute } from '../$';
import { Route as AuthLayoutRoute } from '../auth';
import { Route as AuthCallbackRoute } from '../auth/callback';
import { Route as ForgotPasswordRoute } from '../auth/forgot-password';
import { Route as AuthIndexRoute } from '../auth/index';
import { Route as ResetPasswordRoute } from '../auth/reset-password';
import { Route as SignInRoute } from '../auth/sign-in';
import { Route as SignUpRoute } from '../auth/sign-up';
import { Route as VerifyRoute } from '../auth/verify';
import { Route as DocsLayoutRoute } from '../docs';
import { Route as GettingStartedDocsRoute } from '../docs/getting-started/$slug';
import { Route as GuideDocsRoute } from '../docs/guides/$slug';
import { Route as DocsIndexRoute } from '../docs/index';
import { Route as FeaturesRoute } from '../features';
import { Route as ImprintRoute } from '../imprint';
import { Route as HomeRoute } from '../index';
import { Route as PricingRoute } from '../pricing';
import { Route as PrivacyPolicyRoute } from '../privacy-policy';
import { Route as SolutionsRoute } from '../solutions';
import { Route as SupportRoute } from '../support';
import { Route as TermsRoute } from '../terms-and-conditions';

afterEach(cleanup);

interface TestRoute {
  readonly options: {
    readonly beforeLoad?: () => unknown;
    readonly component?: ComponentType;
    readonly loader?: () => unknown;
  };
}

function routeComponent(route: unknown): ComponentType {
  const component = (route as TestRoute).options.component;
  if (!component) throw new Error('Expected route component');
  return component;
}

function captureThrown(callback: () => unknown): unknown {
  try {
    callback();
  } catch (error) {
    return error;
  }
  throw new Error('Expected callback to throw');
}

function expectRouteRender(route: unknown, testId: string) {
  const Component = routeComponent(route);
  render(<Component />);
  expect(screen.getByTestId(testId)).toBeTruthy();
}

function expectRedirect(route: unknown, options: unknown) {
  const beforeLoad = (route as TestRoute).options.beforeLoad;
  expect(beforeLoad).toBeTypeOf('function');
  expect(captureThrown(() => beforeLoad?.())).toEqual({ kind: 'redirect', options });
}

describe('R02 catch-all route accountability', () => {
  it('throws the router not-found result for an unmatched deep link', () => {
    const loader = (CatchAllRoute as TestRoute).options.loader;
    expect(loader).toBeTypeOf('function');
    expect(captureThrown(() => loader?.())).toEqual({ kind: 'not-found' });
    expect(routerMocks.notFound).toHaveBeenCalledOnce();
  });
});

describe('R02 auth route accountability', () => {
  it('renders the auth layout outlet', () => {
    expectRouteRender(AuthLayoutRoute, 'router-outlet');
  });

  it('renders the auth callback handler page', () => {
    expectRouteRender(AuthCallbackRoute, 'auth-callback-page');
  });

  it('renders the forgot-password form', () => {
    expectRouteRender(ForgotPasswordRoute, 'forgot-password-form');
  });

  it('redirects the auth index to the sign-in route', () => {
    expectRedirect(AuthIndexRoute, { to: '/auth/sign-in' });
  });

  it('renders the reset-password form', () => {
    expectRouteRender(ResetPasswordRoute, 'reset-password-form');
  });

  it('renders the sign-in form', () => {
    expectRouteRender(SignInRoute, 'sign-in-form');
  });

  it('renders the sign-up form', () => {
    expectRouteRender(SignUpRoute, 'sign-up-form');
  });

  it('renders the verification form', () => {
    expectRouteRender(VerifyRoute, 'verify-form');
  });
});

describe('R02 docs route accountability', () => {
  it('renders the docs shell around the nested route outlet', () => {
    const Component = routeComponent(DocsLayoutRoute);
    render(<Component />);
    expect(screen.getByTestId('docs-shell').contains(screen.getByTestId('router-outlet'))).toBe(
      true
    );
  });

  it('renders the docs landing page', () => {
    expectRouteRender(DocsIndexRoute, 'docs-landing-page');
  });

  it('passes a getting-started deep-link slug to the content page', () => {
    const Component = routeComponent(GettingStartedDocsRoute);
    render(<Component />);
    expect(screen.getByTestId('docs-content-page').textContent).toBe(
      'getting-started:deep-link-slug'
    );
  });

  it('passes a guide deep-link slug to the content page', () => {
    const Component = routeComponent(GuideDocsRoute);
    render(<Component />);
    expect(screen.getByTestId('docs-content-page').textContent).toBe('guide:deep-link-slug');
  });
});

describe('R02 public route accountability', () => {
  it('redirects the features route to its landing-page anchor', () => {
    expectRedirect(FeaturesRoute, { to: '/', hash: 'features' });
  });

  it('redirects the imprint route to its landing-page anchor', () => {
    expectRedirect(ImprintRoute, { to: '/', hash: 'imprint' });
  });

  it('renders the public home page', () => {
    expectRouteRender(HomeRoute, 'home-page');
  });

  it('renders the pricing page', () => {
    expectRouteRender(PricingRoute, 'pricing-page');
  });

  it('renders the privacy-policy page', () => {
    expectRouteRender(PrivacyPolicyRoute, 'privacy-policy-page');
  });

  it('redirects the solutions route to its landing-page anchor', () => {
    expectRedirect(SolutionsRoute, { to: '/', hash: 'solutions' });
  });

  it('renders the support page', () => {
    expectRouteRender(SupportRoute, 'support-page');
  });

  it('renders the terms-and-conditions page', () => {
    expectRouteRender(TermsRoute, 'terms-page');
  });
});

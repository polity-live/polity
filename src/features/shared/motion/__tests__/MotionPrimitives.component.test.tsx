/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MotionGroup,
  MotionItem,
  MotionPage,
  PresenceSwap,
  ScrollReveal,
  SuccessTransition,
} from '../MotionPrimitives';

const mocks = vi.hoisted(() => ({ pathname: '/current' }));

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: any) => select({ location: { pathname: mocks.pathname } }),
}));

vi.mock('motion/react', () => {
  const component =
    (tag: 'div' | 'section') =>
    ({
      children,
      variants: _variants,
      initial,
      animate,
      exit,
      whileInView,
      viewport,
      ...props
    }: any) => {
      const Tag = tag;
      return (
        <Tag
          data-initial={typeof initial === 'string' ? initial : undefined}
          data-animate={typeof animate === 'string' ? animate : undefined}
          data-exit={typeof exit === 'string' ? exit : undefined}
          data-while-in-view={whileInView}
          data-viewport={viewport ? JSON.stringify(viewport) : undefined}
          {...props}
        >
          {children}
        </Tag>
      );
    };
  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: { div: component('div'), section: component('section') },
  };
});

afterEach(() => cleanup());

describe('MotionPrimitives', () => {
  it('uses pathname and explicit route keys for page transitions', () => {
    const current = render(<MotionPage className="page">Current page</MotionPage>);
    expect(screen.getByText('Current page').className).toContain('min-w-0');
    current.unmount();

    render(
      <MotionPage routeKey="custom" data-testid="custom-page">
        Custom page
      </MotionPage>
    );
    expect(screen.getByTestId('custom-page').getAttribute('data-initial')).toBe('initial');
  });

  it('renders group, item, presence, and success wrappers', () => {
    render(
      <>
        <MotionGroup data-testid="group">Group</MotionGroup>
        <MotionItem data-testid="item">Item</MotionItem>
        <PresenceSwap motionKey="swap" className="swap">
          Swap
        </PresenceSwap>
        <SuccessTransition data-testid="success" className="custom-success">
          Success
        </SuccessTransition>
      </>
    );
    expect(screen.getByTestId('group').getAttribute('data-animate')).toBe('animate');
    expect(screen.getByTestId('item')).toBeTruthy();
    expect(screen.getByText('Swap').className).toContain('swap');
    expect(screen.getByTestId('success').className).toContain('civic-success-settle');
  });

  it('renders default div and explicit section scroll reveals', () => {
    const defaultReveal = render(<ScrollReveal data-testid="reveal">Reveal</ScrollReveal>);
    expect(screen.getByTestId('reveal').tagName).toBe('DIV');
    expect(screen.getByTestId('reveal').getAttribute('data-viewport')).toBe(
      JSON.stringify({ once: true, amount: 0.2 })
    );
    defaultReveal.unmount();

    render(
      <ScrollReveal as="section" amount={0.8} once={false} data-testid="section-reveal">
        Section
      </ScrollReveal>
    );
    expect(screen.getByTestId('section-reveal').tagName).toBe('SECTION');
    expect(screen.getByTestId('section-reveal').getAttribute('data-viewport')).toBe(
      JSON.stringify({ once: false, amount: 0.8 })
    );
  });
});

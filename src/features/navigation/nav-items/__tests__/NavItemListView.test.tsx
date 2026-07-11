/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NavItemListView } from '../NavItemListView';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: any) => {
    const linkProps = { ...props };
    delete linkProps.children;
    delete linkProps.preload;
    delete linkProps.to;
    return (
      <a href={props.to} {...linkProps}>
        {props.children}
      </a>
    );
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const navigationItems = [
  {
    id: 'home',
    icon: 'Home',
    label: 'Home',
    href: '/home',
    badge: 2,
  },
];

function renderButtonList(isMobile: boolean, isPrimary = true) {
  return render(
    <NavItemListView
      navigationItems={navigationItems}
      isMobile={isMobile}
      isPrimary={isPrimary}
      navigationView="asButtonList"
      pathname="/home"
      hash=""
      isRouterPending={false}
      normalizedHash=""
      currentRoute="/home"
      loadingItem={null}
      setLoadingItem={vi.fn()}
      handleItemClick={vi.fn()}
    />
  );
}

describe('NavItemListView asButtonList', () => {
  it.each([
    ['desktop', false],
    ['mobile', true],
  ])('renders a single accessible link with a non-stateful label on %s', (_layout, isMobile) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderButtonList(isMobile);

    const link = screen.getByRole('link', { name: 'Home' });
    expect(link.getAttribute('href')).toBe('/home');
    expect(link.getAttribute('title')).toBe('Home');
    expect(link.querySelector('button')).toBeNull();

    fireEvent.mouseEnter(link);
    link.focus();
    expect(document.activeElement).toBe(link);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('keeps native labels on secondary desktop navigation links', () => {
    renderButtonList(false, false);

    const link = screen.getByRole('link', { name: 'Home' });
    expect(link.getAttribute('title')).toBe('Home');
  });

  it('runs custom navigation actions without following the placeholder href', () => {
    const onClick = vi.fn();
    render(
      <NavItemListView
        navigationItems={[{ ...navigationItems[0], href: undefined, onClick }]}
        isMobile={false}
        isPrimary
        navigationView="asButtonList"
        pathname="/home"
        hash=""
        isRouterPending={false}
        normalizedHash=""
        currentRoute="/home"
        loadingItem={null}
        setLoadingItem={vi.fn()}
        handleItemClick={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

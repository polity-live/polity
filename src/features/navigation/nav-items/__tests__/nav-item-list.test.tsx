// @vitest-environment jsdom

import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  location: { pathname: undefined as string | undefined, hash: undefined as string | undefined },
  view: vi.fn((_props: any) => <div data-testid="nav-view" />),
}));

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => mocks.location,
}));

vi.mock('../NavItemListView', () => ({
  NavItemListView: (props: any) => mocks.view(props),
}));

import { NavItemList } from '../nav-item-list';

let nextFrameId = 0;
let frames = new Map<number, FrameRequestCallback>();
let cancelAnimationFrame: ReturnType<typeof vi.fn>;

function runNextFrame() {
  const entry = frames.entries().next().value as [number, FrameRequestCallback] | undefined;
  if (!entry) return;
  frames.delete(entry[0]);
  act(() => entry[1](0));
}

function navProps(navigationItems: any[], isPrimary = false) {
  return {
    navigationItems,
    isMobile: false,
    isPrimary,
    navigationView: 'expanded' as any,
    screenType: 'desktop' as any,
  };
}

beforeEach(() => {
  mocks.location = { pathname: undefined, hash: undefined };
  mocks.view.mockClear();
  nextFrameId = 0;
  frames = new Map();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    nextFrameId += 1;
    frames.set(nextFrameId, callback);
    return nextFrameId;
  });
  cancelAnimationFrame = vi
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation(id => void frames.delete(id));
  vi.spyOn(window, 'getComputedStyle').mockImplementation(
    element =>
      ({ scrollMarginTop: element.getAttribute('data-margin') ?? '10px' }) as CSSStyleDeclaration
  );
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('NavItemList', () => {
  it('normalizes missing and explicit hashes and forwards optional click handlers', () => {
    const onClick = vi.fn();
    const items = [
      { id: 'click', href: '/x', onClick },
      { id: 'passive', href: '/y' },
    ];
    const view = render(<NavItemList {...navProps(items, true)} />);
    let props = mocks.view.mock.calls.at(-1)?.[0];
    expect(props).toMatchObject({ normalizedHash: '', currentRoute: '/', isRouterPending: false });
    props.handleItemClick(items[0]);
    props.handleItemClick(items[1]);
    props.setLoadingItem('ignored');
    expect(onClick).toHaveBeenCalledTimes(1);

    mocks.location = { pathname: undefined, hash: 'section' };
    view.rerender(<NavItemList {...navProps(items, true)} />);
    props = mocks.view.mock.calls.at(-1)?.[0];
    expect(props.normalizedHash).toBe('#section');
    expect(props.currentRoute).toBe('/#section');

    mocks.location = { pathname: '/features', hash: '#ready' };
    view.rerender(<NavItemList {...navProps(items, true)} />);
    props = mocks.view.mock.calls.at(-1)?.[0];
    expect(props.normalizedHash).toBe('#ready');
    expect(props.currentRoute).toBe('/features#ready');
  });

  it('recognizes same-page landing hashes, query paths, and encoded section ids', async () => {
    mocks.location = { pathname: 'features', hash: 'encoded%20section' };
    const section = document.createElement('section');
    section.id = 'encoded section';
    section.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    document.body.append(section);
    const items = [
      { id: 'encoded', href: '/#encoded%20section' },
      { id: 'same', href: 'features#same' },
      { id: 'local', href: '#local' },
      { id: 'query', href: '/features?tab=one#query' },
      { id: 'invalid-encoding', href: '#%E0%A4%A' },
      { id: 'other', href: '/other#other' },
      { id: 'plain', href: '/features' },
      { id: 'empty', href: '/features#' },
      { id: 'missing' },
    ];

    render(<NavItemList {...navProps(items)} />);
    await waitFor(() =>
      expect(mocks.view.mock.calls.at(-1)?.[0].currentRoute).toBe('/#encoded section')
    );
    runNextFrame();
    expect(mocks.view.mock.calls.at(-1)?.[0].currentRoute).toBe('/#encoded section');
  });

  it('keeps null state when no matching DOM section exists', () => {
    mocks.location = { pathname: '/', hash: '' };
    const items = [{ id: 'missing', href: '#missing' }];
    const rendered = render(<NavItemList {...navProps(items)} />);
    runNextFrame();
    expect(mocks.view.mock.calls.at(-1)?.[0].currentRoute).toBe('/#missing');
    rendered.unmount();
    expect(cancelAnimationFrame).not.toHaveBeenCalled();
  });

  it('tracks scrolling, coalesces frames, retains valid state, and cancels pending work', async () => {
    mocks.location = { pathname: '/', hash: '' };
    const a = document.createElement('section');
    a.id = 'a';
    a.setAttribute('data-margin', '10px');
    a.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    const b = document.createElement('section');
    b.id = 'b';
    b.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    const c = document.createElement('section');
    c.id = 'c';
    c.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    document.body.append(a, b, c);
    const firstItems = [
      { id: 'a', href: '#a' },
      { id: 'b', href: '#b' },
    ];
    const rendered = render(<NavItemList {...navProps(firstItems)} />);
    await waitFor(() => expect(mocks.view.mock.calls.at(-1)?.[0].currentRoute).toBe('/#a'));

    window.dispatchEvent(new Event('scroll'));
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    runNextFrame();
    expect(mocks.view.mock.calls.at(-1)?.[0].currentRoute).toBe('/#a');

    a.setAttribute('data-margin', 'normal');
    b.getBoundingClientRect = () => ({ top: 5 }) as DOMRect;
    window.dispatchEvent(new Event('scroll'));
    runNextFrame();
    await waitFor(() => expect(mocks.view.mock.calls.at(-1)?.[0].currentRoute).toBe('/#b'));

    mocks.location = { pathname: '/', hash: '#' };
    rendered.rerender(<NavItemList {...navProps(firstItems)} />);
    await waitFor(() => expect(mocks.view.mock.calls.at(-1)?.[0].currentRoute).toBe('/#b'));

    mocks.location = { pathname: '/', hash: '#missing' };
    rendered.rerender(<NavItemList {...navProps(firstItems)} />);
    await waitFor(() => expect(mocks.view.mock.calls.at(-1)?.[0].currentRoute).toBe('/#b'));

    const nextItems = [{ id: 'c', href: '#c' }];
    rendered.rerender(<NavItemList {...navProps(nextItems)} />);
    await waitFor(() => expect(mocks.view.mock.calls.at(-1)?.[0].currentRoute).toBe('/#c'));

    window.dispatchEvent(new Event('resize'));
    rendered.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('returns no active hash route for an empty secondary item list', () => {
    mocks.location = { pathname: '/', hash: '' };
    render(<NavItemList {...navProps([])} />);
    expect(mocks.view.mock.calls.at(-1)?.[0].currentRoute).toBe('/');
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });
});

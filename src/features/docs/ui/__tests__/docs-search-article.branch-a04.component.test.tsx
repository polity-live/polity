/* @vitest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  matches: [] as any[],
  observerCallback: undefined as IntersectionObserverCallback | undefined,
  observerDisconnect: vi.fn(),
  observerObserve: vi.fn(),
  registry: {
    navigation: [] as any[],
    pages: [] as any[],
    related: [] as any[],
  },
  user: null as null | { id: string },
  transformedUrls: [] as string[],
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => state.navigate,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/features/navigation/nav-items/icon-map', () => ({
  getIconComponent: () => (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
}));
vi.mock('../../logic/docsSearch', () => ({
  searchDocs: () => state.matches,
}));
vi.mock('../../logic/docsRegistry', () => ({
  getDocsNavigation: () => state.registry.navigation,
  getDocsPages: () => state.registry.pages,
  getRelatedDocsPages: () => state.registry.related,
}));
vi.mock('@/features/shared/ui/ui/command', () => ({
  CommandDialog: ({ children, onOpenChange, open }: any) => (
    <div data-testid="command-dialog" data-open={String(open)}>
      <button type="button" data-testid="dialog-close" onClick={() => onOpenChange(false)} />
      {children}
    </div>
  ),
  CommandEmpty: ({ children }: any) => <div>{children}</div>,
  CommandGroup: ({ children }: any) => <div>{children}</div>,
  CommandInput: ({ onValueChange, value, ...props }: any) => (
    <input value={value} onChange={event => onValueChange(event.target.value)} {...props} />
  ),
  CommandItem: ({ children, onSelect, ...props }: any) => (
    <button type="button" onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  CommandList: ({ children }: any) => <div>{children}</div>,
  CommandShortcut: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('react-markdown', () => ({
  defaultUrlTransform: (url: string) => `safe:${url}`,
  default: ({ components, urlTransform }: any) => {
    const urls = ['/internal', 'https://example.test', 'mailto:test@example.test', 'javascript:x'];
    state.transformedUrls.push(...urls.map(url => urlTransform(url) as string));
    const P = components.p;
    const Strong = components.strong;
    const Ul = components.ul;
    const Ol = components.ol;
    const Li = components.li;
    const Code = components.code;
    const Blockquote = components.blockquote;
    const Anchor = components.a;
    const Image = components.img;
    const Table = components.table;
    const Th = components.th;
    const Td = components.td;
    return (
      <div>
        <P>paragraph</P>
        <Strong>strong</Strong>
        <Ul>
          <Li>unordered</Li>
        </Ul>
        <Ol>
          <Li>ordered</Li>
        </Ol>
        <Code>code</Code>
        <Blockquote>quote</Blockquote>
        <Anchor href="https://example.test">external</Anchor>
        <Anchor href="/internal">internal</Anchor>
        <Image src="image.png" alt="image" />
        <Image src={undefined} alt={undefined} />
        <Table>
          <tbody>
            <tr>
              <Th>heading</Th>
              <Td>cell</Td>
            </tr>
          </tbody>
        </Table>
      </div>
    );
  },
}));
vi.mock('remark-gfm', () => ({ default: {} }));

import type { DocsPage } from '../../types/docs.types';
import { DocsArticle } from '../DocsArticle';
import {
  DocsSearchField,
  DocsSearchProvider,
  DocsSearchTrigger,
  useDocsSearch,
} from '../DocsSearch';

function page(overrides: Partial<DocsPage> = {}): DocsPage {
  return {
    audience: 'Members',
    category: 'collaboration',
    description: 'Description',
    featured: false,
    icon: 'Users',
    keywords: [],
    kind: 'guide',
    order: 0,
    related: [],
    route: '/docs/guides/groups',
    sections: [{ id: 'overview', title: 'Overview', markdown: 'markdown' }],
    slug: 'groups',
    title: 'Groups',
    ...overrides,
  };
}

class ObserverStub {
  constructor(callback: IntersectionObserverCallback) {
    state.observerCallback = callback;
  }
  observe = state.observerObserve;
  disconnect = state.observerDisconnect;
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.matches = [];
  state.user = null;
  state.transformedUrls = [];
  state.registry.navigation = [];
  state.registry.related = [];
  state.registry.pages = [];
  state.observerCallback = undefined;
  vi.stubGlobal('IntersectionObserver', ObserverStub);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DocsSearch remaining branches', () => {
  it('handles keyboard targets, page-only results, dialog state, and both trigger layouts', () => {
    state.matches = [
      {
        excerpt: 'Result excerpt',
        page: { slug: 'groups', title: 'Groups', description: 'Description' },
        route: '/docs/guides/groups',
      },
    ];
    render(
      <DocsSearchProvider>
        <DocsSearchTrigger data-action-id="compact" />
        <DocsSearchTrigger data-action-id="prominent" prominent className="custom" />
      </DocsSearchProvider>
    );

    const typingInput = document.createElement('input');
    const typingArea = document.createElement('textarea');
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    for (const target of [typingInput, typingArea, editable]) {
      document.body.append(target);
      fireEvent.keyDown(target, { key: '/' });
    }
    fireEvent.keyDown(document.body, { key: 'x' });
    expect(screen.getByTestId('command-dialog').dataset.open).toBe('false');
    fireEvent.keyDown(document.body, { key: '/' });
    expect(screen.getByTestId('command-dialog').dataset.open).toBe('true');

    const commandInput = screen.getByTestId('command-dialog').querySelector('input')!;
    fireEvent.change(commandInput, { target: { value: 'groups' } });
    fireEvent.click(document.querySelector('[data-action-id="docs.search.result.select"]')!);
    expect(state.navigate).toHaveBeenCalledWith({ to: '/docs/guides/groups' });
    fireEvent.click(screen.getByTestId('dialog-close'));
    fireEvent.click(document.querySelector('[data-action-id="docs.search.results.open-all"]')!);
    expect(state.navigate).toHaveBeenCalledWith({ to: '/docs/search', search: { q: 'groups' } });
    expect(document.querySelector('[data-action-id="compact"]')?.className).toContain('h-10');
    expect(document.querySelector('[data-action-id="prominent"]')?.className).toContain('min-h-16');
  });

  it('throws outside its provider and tolerates an omitted field callback', () => {
    expect(() => renderHook(() => useDocsSearch())).toThrow(/DocsSearchProvider/);
    render(<DocsSearchField />);
    const form = document.querySelector('[data-action-id="docs.search-field.submit"]')!;
    const input = document.querySelector('[data-action-id="docs.search-field.query.change"]')!;
    expect(document.querySelector('[data-action-id="docs.search-field.clear"]')).toBeNull();
    fireEvent.change(input, { target: { value: ' query ' } });
    fireEvent.submit(form);
    fireEvent.click(document.querySelector('[data-action-id="docs.search-field.clear"]')!);
  });
});

describe('DocsArticle remaining branches', () => {
  it('renders markdown fallbacks, default signed-out actions, and intersection changes', () => {
    const current = page({
      primaryAction: { label: 'Act', route: '/act', requiresAuth: true },
      sections: [
        { id: 'overview', title: 'Overview', markdown: 'markdown' },
        { id: 'details', title: 'Details', markdown: 'more' },
      ],
    });
    state.registry.navigation = [];
    state.registry.pages = [current, page({ slug: 'events', title: 'Next', route: '/next' })];
    const view = render(<DocsArticle page={current} />);

    expect(screen.getByRole('link', { name: /Act/ }).getAttribute('href')).toBe('/auth/sign-in');
    expect(new Set(state.transformedUrls)).toEqual(
      new Set(['safe:/internal', 'safe:https://example.test', 'safe:mailto:test@example.test', ''])
    );
    expect(document.querySelectorAll('img')[1]?.getAttribute('src')).toBeNull();
    expect(document.querySelectorAll('img')[1]?.getAttribute('alt')).toBe('');
    expect(screen.getByText('pages.docs.hub.browseTitle')).toBeTruthy();

    act(() => {
      state.observerCallback?.([], {} as IntersectionObserver);
      state.observerCallback?.(
        [
          { isIntersecting: false, target: document.getElementById('overview')! },
          {
            isIntersecting: true,
            target: document.getElementById('overview')!,
            boundingClientRect: { top: 20 },
          },
          {
            isIntersecting: true,
            target: document.getElementById('details')!,
            boundingClientRect: { top: 10 },
          },
        ] as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver
      );
    });
    expect(document.querySelectorAll('[aria-current="location"]')).toHaveLength(2);

    state.user = { id: 'user-1' };
    view.rerender(<DocsArticle page={current} />);
    expect(screen.getByRole('link', { name: /Act/ }).getAttribute('href')).toBe('/act');
  });

  it('handles empty sections, getting-started metadata, inactive contents, and public actions', () => {
    const current = page({
      audience: 'New users',
      category: 'getting-started',
      kind: 'getting-started',
      primaryAction: { label: 'Public', route: '/public' },
      sections: [],
    });
    state.registry.pages = [current];
    state.registry.related = [];
    render(<DocsArticle page={current} />);

    expect(screen.getByText('pages.docs.hub.startTitle')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Public/ }).getAttribute('href')).toBe('/public');
    expect(document.querySelector('[data-action-id="docs.article.previous.open"]')).toBeNull();
    expect(document.querySelector('[data-action-id="docs.article.next.open"]')).toBeNull();
    expect(state.observerObserve).not.toHaveBeenCalled();
  });
});

/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DocsSearchField, DocsSearchProvider, DocsSearchTrigger } from '../DocsSearch';

const navigate = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ matches: [] as any[] }));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));
vi.mock('../../logic/docsSearch', () => ({ searchDocs: () => search.matches }));
vi.mock('@/features/shared/ui/ui/command', () => ({
  CommandDialog: ({ children }: any) => <div>{children}</div>,
  CommandEmpty: ({ children }: any) => <div>{children}</div>,
  CommandGroup: ({ children }: any) => <div>{children}</div>,
  CommandInput: ({ onValueChange, value, ...props }: any) => (
    <input value={value} onChange={event => onValueChange?.(event.target.value)} {...props} />
  ),
  CommandItem: ({ children, onSelect, ...props }: any) => (
    <button type="button" onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  CommandList: ({ children }: any) => <div>{children}</div>,
  CommandShortcut: ({ children }: any) => <span>{children}</span>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  search.matches = [];
});

describe('DocsSearch action contracts', () => {
  it('selects a result and opens all results through stable search intents', () => {
    search.matches = [
      {
        page: { slug: 'groups', title: 'Groups', description: 'Groups guide' },
        section: { id: 'roles', title: 'Roles' },
        excerpt: 'Manage roles',
        route: '/docs/guides/groups#roles',
      },
    ];
    render(
      <DocsSearchProvider>
        <DocsSearchTrigger data-action-id="docs.search.test-trigger" />
      </DocsSearchProvider>
    );

    fireEvent.click(document.querySelector('[data-action-id="docs.search.test-trigger"]')!);
    const query = document.querySelector('input') as HTMLInputElement;
    fireEvent.change(query, { target: { value: 'groups' } });
    const result = document.querySelector('[data-action-id="docs.search.result.select"]')!;
    fireEvent.click(result);
    expect(navigate).toHaveBeenCalledWith({ to: '/docs/guides/groups', hash: 'roles' });

    const allResults = document.querySelector('[data-action-id="docs.search.results.open-all"]')!;
    fireEvent.click(allResults);
    expect(navigate).toHaveBeenCalledWith({ to: '/docs/search', search: { q: 'groups' } });
  });

  it('changes, submits, and clears the standalone docs query through stable intents', () => {
    const onSearch = vi.fn();
    render(<DocsSearchField initialQuery="groups" onSearch={onSearch} />);

    const form = document.querySelector('[data-action-id="docs.search-field.submit"]')!;
    const query = document.querySelector(
      '[data-action-id="docs.search-field.query.change"]'
    ) as HTMLInputElement;
    const clear = document.querySelector('[data-action-id="docs.search-field.clear"]')!;
    query.focus();
    expect(document.activeElement).toBe(query);
    fireEvent.change(query, { target: { value: 'events' } });
    fireEvent.submit(form);
    fireEvent.click(clear);
    expect(onSearch).toHaveBeenNthCalledWith(1, 'events');
    expect(onSearch).toHaveBeenNthCalledWith(2, 'events');
    expect(onSearch).toHaveBeenNthCalledWith(3, '');
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  createRootRoute: (options: unknown) => options,
  HeadContent: () => null,
  Outlet: () => null,
  Scripts: () => null,
}));

import { resolveStylesHref, RootLayout, Route } from '../__root';

describe('root layout contract', () => {
  it('selects development and production stylesheet URLs', () => {
    expect(resolveStylesHref(true, '/assets/styles.css')).toBe('/src/styles.css?direct');
    expect(resolveStylesHref(false, '/assets/styles.css')).toBe('/assets/styles.css');
  });

  it('wires the deterministic hydration marker into the document body', () => {
    const documentTree = RootLayout();

    expect(documentTree.type).toBe('html');
    expect((Route as unknown as { component: unknown }).component).toBe(RootLayout);
  });

  it('publishes the document metadata and asset links', () => {
    const head = (Route as unknown as { head: () => { links: unknown[]; meta: unknown[] } }).head();

    expect(head.meta).toContainEqual({ charSet: 'UTF-8' });
    expect(head.meta).toContainEqual(expect.objectContaining({ title: expect.any(String) }));
    expect(head.links).toContainEqual(
      expect.objectContaining({ rel: 'stylesheet', href: expect.any(String) })
    );
    expect(head.links).toContainEqual({ rel: 'manifest', href: '/manifest.en.json' });
  });
});

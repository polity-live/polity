/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@platejs/toc', () => ({
  BaseTocPlugin: { key: 'toc' },
  isHeading: (node: any) => String(node.type).startsWith('h'),
}));

vi.mock('platejs', () => ({
  NodeApi: { string: (node: any) => node.text },
}));

import { useTocElementStaticController } from '../useTocElementStaticController';

describe('useTocElementStaticController', () => {
  it('handles a missing editor and custom heading query', () => {
    const missing = renderHook(() => useTocElementStaticController());
    expect(missing.result.current.headingList).toEqual([]);
    missing.unmount();

    const custom = [{ id: 'custom', depth: 2, path: [0], title: 'Custom', type: 'h2' }];
    const editor = {
      getOptions: () => ({ queryHeading: () => custom }),
    } as any;
    const queried = renderHook(() => useTocElementStaticController(editor));
    expect(queried.result.current.headingList).toEqual(custom);
    expect(queried.result.current.emptyLabel).toBe('plateJs.toolbar.tableOfContents.createHeading');
  });

  it('handles missing node iteration and builds headings while skipping empty titles', () => {
    const noValues = {
      api: { nodes: () => undefined },
      getOptions: () => ({}),
    } as any;
    const empty = renderHook(() => useTocElementStaticController(noValues));
    expect(empty.result.current.headingList).toEqual([]);
    empty.unmount();

    const nodes = [
      [{ id: 'first', text: 'First', type: 'h1' }, [0]],
      [{ id: 'empty', text: '', type: 'h3' }, [1]],
      [{ id: 'sixth', text: 'Sixth', type: 'h6' }, [2]],
    ];
    const editor = {
      api: {
        nodes: ({ match }: any) => {
          expect(match({ type: 'h2' })).toBe(true);
          expect(match({ type: 'p' })).toBe(false);
          return nodes;
        },
      },
      getOptions: () => ({ queryHeading: null }),
    } as any;
    const populated = renderHook(() => useTocElementStaticController(editor));
    expect(populated.result.current.headingList).toEqual([
      { depth: 1, id: 'first', path: [0], title: 'First', type: 'h1' },
      { depth: 6, id: 'sixth', path: [2], title: 'Sixth', type: 'h6' },
    ]);
  });
});

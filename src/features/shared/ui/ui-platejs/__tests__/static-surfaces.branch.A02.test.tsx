/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apple: false,
  ordered: false,
  equationHtml: '<math>result</math>',
}));

vi.mock('@platejs/list', () => ({ isOrderedList: () => mocks.ordered }));
vi.mock('@platejs/math', () => ({ getEquationHtml: () => mocks.equationHtml }));
vi.mock('platejs', () => ({
  get IS_APPLE() {
    return mocks.apple;
  },
  KEYS: { bold: 'bold', italic: 'italic', underline: 'underline' },
  NodeApi: { string: (node: { text?: string }) => node.text ?? '' },
}));
vi.mock('platejs/static', () => ({
  SlateElement: ({ as: Tag = 'div', children, element: _element, attributes, ...props }: any) => (
    <Tag {...attributes} {...props}>
      {children}
    </Tag>
  ),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

import { BlockListStatic } from '../block-list-static';
import { ColumnElementStatic, ColumnGroupElementStatic } from '../column-node-static';
import { EquationElementStatic, InlineEquationElementStatic } from '../equation-node-static';
import {
  H1ElementStatic,
  H2ElementStatic,
  H3ElementStatic,
  H4ElementStatic,
  H5ElementStatic,
  H6ElementStatic,
  HeadingElementStatic,
} from '../heading-node-static';
import { ImageElementStatic } from '../media-image-node-static';
import { MentionElementStatic } from '../mention-node-static';
import { TocElementStaticView } from '../TocElementStaticView';

const props = (element: Record<string, unknown>, children: ReactNode = <span>child</span>) =>
  ({ element, children, attributes: { alt: 'asset' } }) as any;

beforeEach(() => {
  mocks.apple = false;
  mocks.ordered = false;
});

afterEach(cleanup);

describe('static Plate surfaces branch campaign A02', () => {
  it('skips non-list nodes and renders unordered, ordered, and todo alternatives', () => {
    expect(BlockListStatic(props({}))).toBeUndefined();

    const unordered = BlockListStatic(props({ listStyleType: 'disc' }));
    const first = render(unordered!(props({ listStyleType: 'disc', listStart: 2 })));
    expect(first.container.querySelector('ul')).toBeTruthy();
    expect(screen.getByText('child')).toBeTruthy();
    first.unmount();

    mocks.ordered = true;
    const ordered = BlockListStatic(props({ listStyleType: 'decimal' }));
    const second = render(ordered!(props({ listStyleType: 'decimal', listStart: 3 })));
    expect(second.container.querySelector('ol')?.getAttribute('start')).toBe('3');
    second.unmount();

    const todo = BlockListStatic(props({ listStyleType: 'todo' }));
    const third = render(todo!(props({ listStyleType: 'todo', checked: false })));
    expect(screen.getByRole('button').getAttribute('data-state')).toBe('unchecked');
    third.rerender(todo!(props({ listStyleType: 'todo', checked: true })));
    expect(screen.getByRole('button').getAttribute('data-state')).toBe('checked');
    expect(third.container.querySelector('li')?.className).toContain('line-through');
  });

  it('renders column widths and the column group', () => {
    const view = render(<ColumnElementStatic {...props({ width: 280 })} />);
    expect((view.container.firstElementChild as HTMLElement).style.width).toBe('280px');
    view.rerender(<ColumnElementStatic {...props({ width: null })} />);
    expect((view.container.firstElementChild as HTMLElement).style.width).toBe('100%');
    view.rerender(<ColumnGroupElementStatic {...props({})} />);
    expect(screen.getByText('child')).toBeTruthy();
  });

  it('renders block and inline equations for empty and populated expressions', () => {
    const view = render(<EquationElementStatic {...props({ texExpression: '' })} />);
    expect(document.body.textContent).toContain('add_a_tex_equation');
    view.rerender(<EquationElementStatic {...props({ texExpression: 'x' })} />);
    expect(view.container.querySelector('span')?.innerHTML).toBe(mocks.equationHtml);
    view.rerender(<InlineEquationElementStatic {...props({ texExpression: '' })} />);
    expect(view.container.querySelector('span')?.className).toContain('hidden');
    view.rerender(<InlineEquationElementStatic {...props({ texExpression: 'x' })} />);
    expect(view.container.querySelector('span')?.className).not.toContain('hidden');
  });

  it('renders every heading adapter and the null-variant fallback', () => {
    const cases = [
      H1ElementStatic,
      H2ElementStatic,
      H3ElementStatic,
      H4ElementStatic,
      H5ElementStatic,
      H6ElementStatic,
    ];
    const expected = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    cases.forEach((Component, index) => {
      const view = render(<Component {...props({})} />);
      expect(view.container.firstElementChild?.tagName).toBe(expected[index]);
      view.unmount();
    });
    const fallback = render(<HeadingElementStatic {...props({})} variant={null} />);
    expect(fallback.container.firstElementChild?.tagName).toBe('H1');
  });

  it('renders images with default/provided alignment and optional captions', () => {
    const view = render(
      <ImageElementStatic
        {...props({ url: 'image.png', width: 200, caption: [{ text: 'caption' }] })}
      />
    );
    expect(screen.getByRole('img').parentElement?.style.textAlign).toBe('center');
    expect(screen.getByText('caption')).toBeTruthy();
    view.rerender(
      <ImageElementStatic {...props({ url: 'image.png', align: 'right', caption: null })} />
    );
    expect(screen.queryByText('caption')).toBeNull();
    expect(screen.getByRole('img').parentElement?.style.textAlign).toBe('right');
  });

  it('renders styled mentions in non-Apple and Apple order', () => {
    const element = {
      value: 'Ada',
      children: [{ text: '', bold: true, italic: true, underline: true }],
    };
    const view = render(<MentionElementStatic {...props(element)} prefix="@" />);
    expect(document.body.textContent).toContain('@Adachild');
    expect(view.container.firstElementChild?.className).toContain('font-bold');

    mocks.apple = true;
    view.rerender(
      <MentionElementStatic {...props({ value: 'Ada', children: [{ text: '' }] })} prefix="@" />
    );
    expect(document.body.textContent).toContain('child@Ada');
  });

  it('renders populated and empty tables of contents at every supported depth', () => {
    const view = render(
      <TocElementStaticView
        {...props({})}
        headingList={
          [
            { title: 'One', depth: 1 },
            { title: 'Two', depth: 2 },
            { title: 'Three', depth: 3 },
          ] as never
        }
        emptyLabel="Nothing"
      />
    );
    expect(screen.getAllByRole('button')).toHaveLength(3);
    view.rerender(<TocElementStaticView {...props({})} headingList={[]} emptyLabel="Nothing" />);
    expect(screen.getByText('Nothing')).toBeTruthy();
  });
});

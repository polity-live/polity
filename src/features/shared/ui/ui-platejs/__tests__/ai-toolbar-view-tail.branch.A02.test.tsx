/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, MouseEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@platejs/selection/react', () => ({ BlockSelectionPlugin: {} }));
vi.mock('@/features/shared/ui/layout', () => ({
  ToolbarButton: ({ children, ...props }: ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}));

import { AIToolbarButtonView } from '../AIToolbarButtonView';

afterEach(cleanup);

describe('AI toolbar view tail branches A02', () => {
  it('honors a prevented consumer click and calls the consumer mouse-down handler', () => {
    const onClick = vi.fn((event: MouseEvent<HTMLButtonElement>) => event.preventDefault());
    const onMouseDown = vi.fn();
    const show = vi.fn();
    render(
      <AIToolbarButtonView
        props={{ children: 'AI', onClick, onMouseDown }}
        api={{ aiChat: { show } }}
        editor={{}}
      />
    );

    expect(fireEvent.click(screen.getByRole('button'))).toBe(false);
    expect(show).not.toHaveBeenCalled();
    expect(fireEvent.mouseDown(screen.getByRole('button'))).toBe(false);
    expect(onMouseDown).toHaveBeenCalledOnce();
  });

  it('uses the current block as the no-selection fallback', () => {
    const show = vi.fn();
    const select = vi.fn();
    const focus = vi.fn();
    const set = vi.fn();
    render(
      <AIToolbarButtonView
        props={{ children: 'AI' }}
        api={{ aiChat: { show } }}
        editor={{
          api: {
            block: () => [{ id: 'current' }, [3]],
            blocks: vi.fn(),
            isExpanded: () => false,
          },
          selection: null,
          getOption: () => false,
          getApi: () => ({ blockSelection: { set } }),
          tf: { select, focus },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(select).toHaveBeenCalledWith([3], { edge: 'end' });
    expect(set).toHaveBeenCalledWith('current');
    expect(show).toHaveBeenCalledOnce();
  });
});

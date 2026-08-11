/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { User } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SectionProgressTopBar } from '../SectionProgressTopBar';

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(cleanup);

describe('SectionProgressTopBar', () => {
  it('renders active, completed, and disabled items with horizontal overflow', () => {
    const onItemSelect = vi.fn();
    const { container } = render(
      <SectionProgressTopBar
        activeId="details"
        countLabel="2/3"
        items={[
          { id: 'profile', label: 'Profile', completed: true, icon: User },
          { id: 'details', label: 'Details', icon: User },
          { id: 'review', label: 'Review', disabled: true, icon: User },
        ]}
        label="Setup"
        onItemSelect={onItemSelect}
        progressValue={66}
      />
    );

    expect(screen.getByText('Setup')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Setup' })).toBeTruthy();
    expect(screen.getByText('2/3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Details' }).getAttribute('aria-current')).toBe(
      'step'
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Review' }).disabled).toBe(true);
    expect(container.querySelector('ol')?.className).toContain('overflow-x-auto');
    expect(container.querySelector('ol')?.className).toContain('scrollbar-hide');
  });

  it('selects enabled items with keyboard and focus while blocking disabled items', () => {
    const onItemSelect = vi.fn();

    render(
      <SectionProgressTopBar
        activeId="one"
        items={[
          { id: 'one', label: 'One' },
          { id: 'two', label: 'Two' },
          { id: 'three', label: 'Three', disabled: true },
        ]}
        onItemSelect={onItemSelect}
        progressValue={33}
      />
    );

    const one = screen.getByRole<HTMLButtonElement>('button', { name: 'One' });
    const two = screen.getByRole<HTMLButtonElement>('button', { name: 'Two' });
    const three = screen.getByRole<HTMLButtonElement>('button', { name: 'Three' });

    expect(screen.getByRole('progressbar', { name: 'Action progress' })).toBeTruthy();
    expect(one.getAttribute('aria-current')).toBe('step');
    expect(two.getAttribute('aria-current')).toBeNull();
    one.focus();
    expect(document.activeElement).toBe(one);
    two.focus();
    expect(document.activeElement).toBe(two);
    fireEvent.keyDown(two, { key: 'Enter' });
    fireEvent.click(two);
    fireEvent.click(screen.getByRole('button', { name: 'Three' }));

    expect(onItemSelect).toHaveBeenCalledTimes(1);
    expect(onItemSelect).toHaveBeenCalledWith('two');
    expect(three.disabled).toBe(true);
  });

  it('scrolls the active item into view when activeId changes', () => {
    const { rerender } = render(
      <SectionProgressTopBar
        activeId="one"
        items={[
          { id: 'one', label: 'One' },
          { id: 'two', label: 'Two' },
        ]}
        progressValue={50}
      />
    );

    scrollIntoView.mockClear();

    rerender(
      <SectionProgressTopBar
        activeId="two"
        items={[
          { id: 'one', label: 'One' },
          { id: 'two', label: 'Two' },
        ]}
        progressValue={100}
      />
    );

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'center',
      behavior: 'smooth',
    });
  });
});

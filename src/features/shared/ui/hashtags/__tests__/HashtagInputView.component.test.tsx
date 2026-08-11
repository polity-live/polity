// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/ui/label.tsx', () => ({
  Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props} />,
}));
vi.mock('@/features/shared/ui/ui/input.tsx', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({
    variant: _variant,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => <button {...props} />,
}));
vi.mock('lucide-react', () => ({
  Hash: (props: React.SVGAttributes<SVGElement>) => <svg data-icon="hash" {...props} />,
  X: (props: React.SVGAttributes<SVGElement>) => <svg data-icon="x" {...props} />,
}));
vi.mock('@/features/shared/logic/hashtagHelpers', () => ({
  getHashtagGradient: (tag: string) => `gradient-${tag}`,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import { HashtagInputView, type HashtagInputViewProps } from '../HashtagInputView';

function props(overrides: Partial<HashtagInputViewProps> = {}): HashtagInputViewProps {
  return {
    value: [],
    onChange: vi.fn(),
    label: 'Hashtags',
    showLabel: true,
    placeholder: 'Add one',
    maxTags: undefined,
    suggestions: [],
    inputId: undefined,
    inputClassName: undefined,
    inputValue: '',
    setInputValue: vi.fn(),
    showSuggestions: false,
    setShowSuggestions: vi.fn(),
    selectedIndex: 0,
    setSelectedIndex: vi.fn(),
    containerRef: createRef<HTMLDivElement>(),
    trimmed: '',
    filteredSuggestions: [],
    resolvedInputId: 'hashtags',
    addHashtag: vi.fn(),
    removeHashtag: vi.fn(),
    handleKeyDown: vi.fn(),
    ...overrides,
  };
}

afterEach(cleanup);

describe('HashtagInputView', () => {
  it('renders a labelled empty input and forwards input interactions', () => {
    const viewProps = props({ inputClassName: 'custom-input' });
    render(<HashtagInputView {...viewProps} />);
    const input = screen.getByLabelText('Hashtags');
    expect(input.className).toContain('custom-input');

    fireEvent.change(input, { target: { value: 'topic' } });
    expect(viewProps.setInputValue).toHaveBeenCalledWith('topic');
    expect(viewProps.setShowSuggestions).toHaveBeenCalledWith(true);
    expect(viewProps.setSelectedIndex).toHaveBeenCalledWith(0);
    fireEvent.focus(input);
    expect(viewProps.setShowSuggestions).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(viewProps.handleKeyDown).toHaveBeenCalled();

    fireEvent.click(screen.getByText('generated.inline.0595_add_61cc55aa'));
    expect(viewProps.addHashtag).toHaveBeenCalledWith();
    expect(screen.queryByText(/generated.inline.0163/)).toBeNull();
  });

  it('renders removable tags, an aria label, and a max count without suggestions', () => {
    const viewProps = props({
      value: ['alpha'],
      showLabel: false,
      maxTags: 3,
      showSuggestions: true,
    });
    const { container } = render(<HashtagInputView {...viewProps} />);
    expect(screen.getByLabelText('Hashtags').className).toBe('pl-9');
    expect(container.querySelector('.gradient-alpha')).toBeTruthy();
    fireEvent.click(container.querySelector('button[type="button"]')!);
    expect(viewProps.removeHashtag).toHaveBeenCalledWith('alpha');
    expect(container.querySelector('p')?.textContent).toContain('1/3');
    expect(screen.queryByRole('button', { name: 'alpha' })).toBeNull();
  });

  it('shows selected and unselected suggestions and supports pointer selection', () => {
    const viewProps = props({
      showSuggestions: true,
      filteredSuggestions: ['alpha', 'beta'],
      selectedIndex: 1,
    });
    render(<HashtagInputView {...viewProps} />);
    const alpha = screen.getByRole('button', { name: 'alpha' });
    const beta = screen.getByRole('button', { name: 'beta' });
    expect(alpha.className).toContain('hover:bg-accent/50');
    expect(beta.className).toContain('bg-accent');

    fireEvent.mouseEnter(alpha);
    expect(viewProps.setSelectedIndex).toHaveBeenCalledWith(0);
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    alpha.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(viewProps.addHashtag).toHaveBeenCalledWith('alpha');
  });
});

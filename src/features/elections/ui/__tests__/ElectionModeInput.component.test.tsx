/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElectionModeInput } from '../ElectionModeInput';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
}));
vi.mock('@/features/shared/ui/form', () => ({
  ChoiceCardField: ({ options, onValueChange, label, description, className, grid }: any) => (
    <section
      data-testid="field"
      data-label={label}
      data-description={description}
      data-grid={grid}
      className={className}
    >
      {options.map((option: any) => (
        <button key={option.value} onClick={() => onValueChange(option.value)}>
          {option.label}|{option.description}|{option.suffix}
        </button>
      ))}
    </section>
  ),
}));

afterEach(cleanup);

describe('ElectionModeInput', () => {
  it('renders both modes with defaults and forwards a selection', () => {
    const onChange = vi.fn();
    render(
      <ElectionModeInput
        value="list"
        onChange={onChange}
        hint="Choose one"
        className="custom"
        descriptions={{ list: 'Several seats' }}
      />
    );

    const field = screen.getByTestId('field');
    expect(field.dataset.label).toBe('features.elections.mode.typeLabel');
    expect(field.dataset.description).toBe('Choose one');
    expect(field.dataset.grid).toBe('two');
    expect(field.className).toBe('custom');
    expect(
      screen.getByText(/Several seats/).querySelector('[data-variant="default"]')
    ).toBeTruthy();
    const single = screen.getByText(/features.elections.mode.single/);
    expect(single.querySelector('[data-variant="outline"]')).toBeTruthy();
    fireEvent.click(single);
    expect(onChange).toHaveBeenCalledWith('single');
  });

  it('accepts an explicit label and an absent descriptions map', () => {
    render(<ElectionModeInput value="single" onChange={vi.fn()} label="Mode" />);
    expect(screen.getByTestId('field').dataset.label).toBe('Mode');
    expect(
      screen.getByText(/features.elections.mode.single/).querySelector('[data-variant="default"]')
    ).toBeTruthy();
  });
});

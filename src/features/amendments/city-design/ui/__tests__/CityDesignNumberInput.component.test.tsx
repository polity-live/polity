/* @vitest-environment jsdom */
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CityDesignNumberInput } from '../CityDesignNumberInput';
afterEach(cleanup);

function Harness({
  commit,
  end = () => undefined,
}: {
  commit: (value: number) => void;
  end?: () => void;
}) {
  const [value, setValue] = useState(3);
  return (
    <CityDesignNumberInput
      aria-label="Width"
      value={value}
      min={0.1}
      max={20}
      onEditEnd={end}
      onCommit={next => {
        setValue(next);
        commit(next);
      }}
    />
  );
}

it('applies valid numbers immediately, preserves comma drafts and does not duplicate changes on Enter', () => {
  const commit = vi.fn();
  const end = vi.fn();
  render(<Harness commit={commit} end={end} />);
  const input = screen.getByRole('textbox', { name: 'Width' }) as HTMLInputElement;
  act(() => input.focus());
  fireEvent.change(input, { target: { value: '5,20' } });
  expect(commit).toHaveBeenCalledExactlyOnceWith(5.2);
  expect(input.value).toBe('5,20');
  input.setSelectionRange(2, 2);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(end).toHaveBeenCalledOnce();
  expect(input.value).toBe('5.2');
});

it('rejects incomplete and out-of-range edits and Escape restores the latest live value', () => {
  const commit = vi.fn();
  render(<Harness commit={commit} />);
  const input = screen.getByRole('textbox', { name: 'Width' }) as HTMLInputElement;
  act(() => input.focus());
  fireEvent.change(input, { target: { value: '6' } });
  commit.mockClear();
  for (const value of ['', '-', 'Infinity', '-3', '0', '21', '6,', '.', '1e2', '0x10']) {
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    expect(commit).not.toHaveBeenCalled();
  }
  act(() => input.focus());
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(input.value).toBe('6');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(commit).not.toHaveBeenCalled();
});

it('retains text and caret through value echoes, resets on selection keys and follows external idle updates', () => {
  const commit = vi.fn();
  const { rerender } = render(
    <CityDesignNumberInput key="a" aria-label="X" value={5.2} onCommit={commit} />
  );
  const input = screen.getByRole('textbox', { name: 'X' }) as HTMLInputElement;
  act(() => input.focus());
  fireEvent.change(input, { target: { value: '5,200' } });
  input.setSelectionRange(2, 2);
  rerender(<CityDesignNumberInput key="a" aria-label="X" value={5.2001} onCommit={commit} />);
  expect(input.value).toBe('5,200');
  expect(input.selectionStart).toBe(2);
  fireEvent.change(input, { target: { value: '-' } });
  rerender(<CityDesignNumberInput key="b" aria-label="X" value={5.2001} onCommit={commit} />);
  expect((screen.getByRole('textbox', { name: 'X' }) as HTMLInputElement).value).toBe('5.2001');
  rerender(<CityDesignNumberInput key="b" aria-label="X" value={-12.5} onCommit={commit} />);
  expect((screen.getByRole('textbox', { name: 'X' }) as HTMLInputElement).value).toBe('-12.5');
  fireEvent.change(screen.getByRole('textbox', { name: 'X' }), { target: { value: '-7,5' } });
  expect(commit).toHaveBeenLastCalledWith(-7.5);
});

it('never calls the mutator for disabled inputs', () => {
  const commit = vi.fn();
  render(<CityDesignNumberInput aria-label="X" value={0} disabled onCommit={commit} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '8' } });
  expect(commit).not.toHaveBeenCalled();
});

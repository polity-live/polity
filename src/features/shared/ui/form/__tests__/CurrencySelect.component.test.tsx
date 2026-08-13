/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CurrencySelect } from '../CurrencySelect';

vi.mock('@/features/shared/hooks/useCurrencyCatalog', () => ({
  useCurrencyCatalog: () => [
    { code: 'EUR', name: 'Euro', label: 'Euro (EUR)' },
    { code: 'USD', name: 'US Dollar', label: 'US Dollar (USD)' },
  ],
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/popover', () => ({
  Popover: ({ children }: React.PropsWithChildren) => <>{children}</>,
  PopoverContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
  PopoverTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/command', () => ({
  Command: ({ children }: React.PropsWithChildren) => <>{children}</>,
  CommandEmpty: ({ children }: React.PropsWithChildren) => <>{children}</>,
  CommandGroup: ({ children }: React.PropsWithChildren) => <>{children}</>,
  CommandInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  CommandList: ({ children }: React.PropsWithChildren) => <>{children}</>,
  CommandItem: ({
    children,
    onSelect,
    value: _value,
  }: React.PropsWithChildren<{
    onSelect: () => void;
    value: string;
  }>) => <button onClick={onSelect}>{children}</button>,
}));

afterEach(cleanup);

describe('CurrencySelect', () => {
  it('shows the selected label and changes currencies', () => {
    const onChange = vi.fn();
    render(<CurrencySelect value="EUR" onChange={onChange} />);
    expect(screen.getByRole('combobox').textContent).toContain('Euro (EUR)');
    fireEvent.click(screen.getByRole('button', { name: /US Dollar/ }));
    expect(onChange).toHaveBeenCalledWith('USD');
  });

  it('falls back to the currency code and explicit accessible label', () => {
    render(<CurrencySelect value="GBP" onChange={vi.fn()} ariaLabel="Currency" disabled />);
    const trigger = screen.getByRole('combobox', { name: 'Currency' }) as HTMLButtonElement;
    expect(trigger.textContent).toContain('GBP');
    expect(trigger.disabled).toBe(true);
  });
});

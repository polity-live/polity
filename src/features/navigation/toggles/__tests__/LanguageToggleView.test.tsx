/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LanguageToggleView } from '../LanguageToggleView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => `translated:${key}`,
}));

vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({ children, variant, size, ...props }: any) => (
    <button data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/ui/ui/dropdown-menu.tsx', () => ({
  DropdownMenuSub: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  DropdownMenuPortal: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuLabel: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/features/shared/ui/ui/popover.tsx', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <>{children}</>,
  PopoverContent: ({ children, side, sideOffset, onMouseLeave, ...props }: any) => (
    <div data-side={side} data-offset={sideOffset} onMouseLeave={onMouseLeave} {...props}>
      {children}
    </div>
  ),
}));

afterEach(() => cleanup());

const labels = {
  english: 'English',
  german: 'German',
  moreLanguages: 'More languages',
  title: 'Choose language',
};

const callbacks = {
  onLanguageChange: vi.fn(),
  onPopoverMouseLeave: vi.fn(),
  onPopoverOpenChange: vi.fn(),
  onPopoverTriggerMouseEnter: vi.fn(),
};

describe('LanguageToggleView', () => {
  it('renders and selects both dropdown languages at small size', () => {
    const onLanguageChange = vi.fn();
    render(
      <LanguageToggleView
        {...callbacks}
        onLanguageChange={onLanguageChange}
        size="small"
        side="right"
        sideOffset={4}
        variant="dropdown"
        isLanguagePopoverOpen={false}
        language="de"
        labels={labels}
      />
    );

    fireEvent.click(
      document.querySelector('[data-action-id="navigation.language.dropdown.english"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.language.dropdown.german"]')!
    );
    expect(onLanguageChange.mock.calls).toEqual([['en'], ['de']]);
    expect(screen.getByText('More languages')).toBeTruthy();
    expect(screen.getAllByText('German').length).toBeGreaterThan(0);
  });

  it.each([
    ['en', 'default', 'ghost'],
    ['de', 'ghost', 'default'],
  ] as const)(
    'renders the %s popover selection state',
    (language, englishVariant, germanVariant) => {
      const onLanguageChange = vi.fn();
      render(
        <LanguageToggleView
          {...callbacks}
          onLanguageChange={onLanguageChange}
          size={language === 'en' ? 'small' : 'default'}
          className="custom"
          side="bottom"
          sideOffset={8}
          variant="popover"
          isLanguagePopoverOpen
          language={language}
          labels={labels}
        />
      );

      const english = document.querySelector(
        '[data-action-id="navigation.language.popover.english"]'
      )!;
      const german = document.querySelector(
        '[data-action-id="navigation.language.popover.german"]'
      )!;
      expect(english.getAttribute('data-variant')).toBe(englishVariant);
      expect(german.getAttribute('data-variant')).toBe(germanVariant);
      fireEvent.click(english);
      fireEvent.click(german);
      expect(onLanguageChange.mock.calls).toEqual([
        ['en', true],
        ['de', true],
      ]);
      fireEvent.mouseEnter(screen.getByRole('button', { name: 'Choose language' }));
      expect(callbacks.onPopoverTriggerMouseEnter).toHaveBeenCalled();
    }
  );
});

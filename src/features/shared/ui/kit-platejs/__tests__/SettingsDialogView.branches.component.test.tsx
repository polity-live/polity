/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/ui/command.tsx', () => ({
  Command: ({ children }: any) => <div>{children}</div>,
  CommandEmpty: ({ children }: any) => <div>{children}</div>,
  CommandGroup: ({ children }: any) => <div>{children}</div>,
  CommandInput: () => <input />,
  CommandItem: ({ children, onSelect }: any) => <button onClick={onSelect}>{children}</button>,
  CommandList: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/dialog.tsx', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/popover.tsx', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { SettingsDialogView, models } from '../SettingsDialogView';

describe('SettingsDialogView branches', () => {
  it('marks selected and unselected models and selects another model', () => {
    const setTempModel = vi.fn();
    const setOpenModel = vi.fn();
    const { container } = render(
      <SettingsDialogView
        editor={{}}
        handleSubmit={vi.fn()}
        open
        openModel
        renderApiKeyInput={() => <div>key input</div>}
        setOpen={vi.fn()}
        setOpenModel={setOpenModel}
        setShowKey={vi.fn()}
        setTempKeys={vi.fn()}
        setTempModel={setTempModel}
        showKey={{}}
        tempKeys={{}}
        tempModel={models[0]}
        toggleKeyVisibility={vi.fn()}
      />
    );
    const checks = [...container.querySelectorAll('.lucide-check')];
    expect(checks.some(check => check.getAttribute('class')?.includes('opacity-100'))).toBe(true);
    expect(checks.some(check => check.getAttribute('class')?.includes('opacity-0'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /gpt-4o$/i }));
    expect(setTempModel).toHaveBeenCalled();
    expect(setOpenModel).toHaveBeenCalledWith(false);
  });
});

/* @vitest-environment jsdom */

import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ tooltip: null as any }));

vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: (props: any) => {
    mocks.tooltip = props;
    return <div>{props.children}</div>;
  },
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu', () => ({
  DropdownMenuRadioGroup: ({ children }: any) => <div>{children}</div>,
  DropdownMenuRadioItem: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

import { EditingModeMenuItems } from '../EditingMode';

describe('EditingMode tooltip branches', () => {
  it('opens and closes the controlled help tooltip', () => {
    render(<EditingModeMenuItems modes={['suggest_event']} onValueChange={vi.fn()} value="view" />);
    act(() => mocks.tooltip.onOpenChange(true));
    expect(mocks.tooltip.open).toBe(true);
    act(() => mocks.tooltip.onOpenChange(false));
    expect(mocks.tooltip.open).toBe(false);
  });
});

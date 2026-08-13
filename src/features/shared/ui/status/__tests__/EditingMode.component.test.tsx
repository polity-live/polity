/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import {
  EditingModeBadge,
  EditingModeMenuItems,
  EVENT_PHASE_LOCKED_MODE_TOOLTIP_KEY,
  SYSTEM_MANAGED_EVENT_MODE_TOOLTIP_KEY,
  getEditingModeOption,
} from '../EditingMode';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { SelectableEditingMode } from '../EditingMode';

const SYSTEM_MANAGED_EVENT_MODE_TOOLTIP = translateText(SYSTEM_MANAGED_EVENT_MODE_TOOLTIP_KEY);
const EVENT_PHASE_LOCKED_MODE_TOOLTIP = translateText(EVENT_PHASE_LOCKED_MODE_TOOLTIP_KEY);

beforeAll(() => {
  class ResizeObserverMock {
    observe = () => undefined;
    unobserve = () => undefined;
    disconnect = () => undefined;
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

afterEach(() => {
  cleanup();
});

function renderMenu(onValueChange = vi.fn(), value: SelectableEditingMode = 'view') {
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent>
        <EditingModeMenuItems value={value} onValueChange={onValueChange} />
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return onValueChange;
}

function renderMenuWithDisabledReasons(
  disabledModeReasons: Partial<Record<SelectableEditingMode, string>>,
  onValueChange = vi.fn(),
  value: SelectableEditingMode = 'view'
) {
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent>
        <EditingModeMenuItems
          value={value}
          disabledModeReasons={disabledModeReasons}
          onValueChange={onValueChange}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return onValueChange;
}

describe('EditingModeMenuItems', () => {
  it('returns display metadata for canonical editing modes', () => {
    const option = getEditingModeOption('vote_internal', (_key, fallback) =>
      typeof fallback === 'string' ? fallback : ''
    );

    expect(option.label).toBe('Internal Voting Mode');
    expect(option.value).toBe('vote_internal');
  });

  it('shows all amendment modes in canonical order by default', () => {
    renderMenu();

    const labels = screen.getAllByRole('menuitemradio').map(item => item.textContent ?? '');

    expect(labels[0]).toContain('Viewing');
    expect(labels[1]).toContain('Collaborative Editing');
    expect(labels[2]).toContain('Internal Suggestions');
    expect(labels[3]).toContain('Internal Voting Mode');
    expect(labels[3]).toContain('Collaborators vote on change requests');
    expect(labels[3]).not.toContain('Time-based');
    expect(labels[4]).toContain('Event Suggestions');
    expect(labels[5]).toContain('Event Voting Mode');
  });

  it('keeps automatic event modes visible but blocks user selection', () => {
    const onValueChange = renderMenu();

    fireEvent.click(screen.getByText('Collaborative Editing'));
    expect(onValueChange).toHaveBeenCalledWith('edit');

    onValueChange.mockClear();
    fireEvent.click(screen.getByText('Event Suggestions'));
    fireEvent.click(screen.getByText('Event Voting Mode'));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('adds help affordances for system-managed event modes', () => {
    renderMenu();

    const helpButtons = screen.getAllByLabelText(SYSTEM_MANAGED_EVENT_MODE_TOOLTIP);

    expect(helpButtons).toHaveLength(2);
    expect(helpButtons[0].getAttribute('aria-label')).toBe(SYSTEM_MANAGED_EVENT_MODE_TOOLTIP);

    fireEvent.click(helpButtons[0]);
    expect(screen.getAllByText(SYSTEM_MANAGED_EVENT_MODE_TOOLTIP).length).toBeGreaterThan(0);
    fireEvent.click(helpButtons[0]);
  });

  it('renders badge icons and manual modes without descriptions', () => {
    const { rerender } = render(<EditingModeBadge mode="edit" showIcon />);
    expect(document.querySelector('svg')).toBeTruthy();

    rerender(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <EditingModeMenuItems
            disabledModeReasons={{ edit: 'custom lock' }}
            onValueChange={vi.fn()}
            showAutomaticEventModes={false}
            showDescriptions={false}
            value="view"
          />
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByText('custom lock')).toBeTruthy();
    expect(screen.queryByText('Event Suggestions')).toBeNull();
  });

  it('locks every mode while event suggestions are active and marks the current mode', () => {
    const onValueChange = renderMenu(vi.fn(), 'suggest_event');

    const items = screen.getAllByRole('menuitemradio');
    expect(items).toHaveLength(6);
    for (const item of items) {
      expect(item.getAttribute('aria-disabled')).toBe('true');
    }

    const currentItem = screen.getByText('Event Suggestions').closest('[role="menuitemradio"]');
    expect(currentItem?.getAttribute('aria-checked')).toBe('true');
    expect(currentItem?.getAttribute('aria-current')).toBe('true');

    expect(screen.getAllByLabelText(EVENT_PHASE_LOCKED_MODE_TOOLTIP)).toHaveLength(4);
    expect(screen.getAllByLabelText(SYSTEM_MANAGED_EVENT_MODE_TOOLTIP)).toHaveLength(2);

    fireEvent.click(screen.getByText('Collaborative Editing'));
    fireEvent.click(screen.getByText('Viewing'));
    fireEvent.click(screen.getByText('Event Voting Mode'));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('marks event voting as the current disabled mode', () => {
    const onValueChange = renderMenu(vi.fn(), 'event_final_closing_vote');

    const currentItem = screen.getByText('Event Voting Mode').closest('[role="menuitemradio"]');
    expect(currentItem?.getAttribute('aria-checked')).toBe('true');
    expect(currentItem?.getAttribute('aria-current')).toBe('true');

    fireEvent.click(screen.getByText('Internal Voting Mode'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('blocks modes with explicit disabled reasons and shows readable reason text', () => {
    const onValueChange = renderMenuWithDisabledReasons({
      vote_internal: 'internal-window-closed',
    });

    fireEvent.click(screen.getByText('Internal Voting Mode'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        translateText('features.amendments.workflowDisabledReasons.internalWindowClosed')
      )
    ).toBeTruthy();

    fireEvent.click(screen.getByText('Collaborative Editing'));
    expect(onValueChange).toHaveBeenCalledWith('edit');
  });
});

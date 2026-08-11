/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AssignHolderDialogView,
  type AssignHolderDialogViewProps,
} from '../AssignHolderDialogView';

HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
HTMLElement.prototype.setPointerCapture = vi.fn();
HTMLElement.prototype.releasePointerCapture = vi.fn();
HTMLElement.prototype.scrollIntoView = vi.fn();
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

afterEach(cleanup);
const props = (
  overrides: Partial<AssignHolderDialogViewProps> = {}
): AssignHolderDialogViewProps => ({
  open: true,
  onOpenChange: vi.fn(),
  role: null,
  groupId: 'g',
  onAssign: vi.fn(),
  searchQuery: '',
  setSearchQuery: vi.fn(),
  popoverOpen: true,
  setPopoverOpen: vi.fn(),
  selectedUserId: null,
  setSelectedUserId: vi.fn(),
  reason: 'appointed',
  setReason: vi.fn(),
  members: [],
  currentHolder: null,
  isElectedRole: false,
  filteredMembers: [],
  selectedMember: null,
  handleSubmit: vi.fn(event => event.preventDefault()),
  ...overrides,
});

describe('AssignHolderDialogView branches', () => {
  it('renders and replaces a current holder using name and avatar fallbacks', () => {
    const { rerender } = render(
      <AssignHolderDialogView
        {...props({ currentHolder: { first_name: 'Ada', handle: 'ada', avatar: 'avatar' } })}
      />
    );
    expect(document.body.textContent).toContain('replace_the_current_holder');
    expect(document.body.textContent).toContain('replace_holder');
    rerender(
      <AssignHolderDialogView
        {...props({ currentHolder: { first_name: '', handle: 'holder', avatar: null } })}
      />
    );
    expect(document.body.textContent).toContain('holder');
    rerender(
      <AssignHolderDialogView
        {...props({ currentHolder: { first_name: '', handle: '', avatar: null } })}
      />
    );
    expect(document.body.textContent).toContain('U');
  });

  it('renders selected and filtered member variants including absent users', () => {
    const selected = {
      user: { id: 'selected', first_name: 'Selected', handle: 'selected-handle', avatar: 'avatar' },
    };
    const filteredMembers = [
      { user: null },
      selected,
      { user: { id: 'handle', first_name: '', handle: 'handle-only', avatar: null } },
      { user: { id: 'unknown', first_name: '', handle: '', avatar: null } },
    ];
    const { rerender } = render(
      <AssignHolderDialogView
        {...props({ selectedMember: selected, selectedUserId: 'selected', filteredMembers })}
      />
    );
    expect(document.body.textContent).toContain('Selected');
    expect(document.body.textContent).toContain('@selected-handle');
    expect(document.body.textContent).toContain('handle-only');
    rerender(
      <AssignHolderDialogView
        {...props({
          selectedMember: {
            user: { id: 'fallback', first_name: '', handle: 'fallback', avatar: null },
          },
          filteredMembers,
        })}
      />
    );
    expect(document.body.textContent).toContain('fallback');
    rerender(
      <AssignHolderDialogView
        {...props({
          selectedMember: { user: { id: 'unknown', first_name: '', handle: '', avatar: null } },
          filteredMembers,
        })}
      />
    );
    expect(document.body.textContent).toContain('U');
  });
});

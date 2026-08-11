/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const remoteCursorState = vi.hoisted(() => ({ controller: vi.fn() }));

vi.mock('@/features/editor/hooks/useRemoteCursorsSyncController', () => ({
  useRemoteCursorsSyncController: (args: unknown) => remoteCursorState.controller(args),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: () => 'Unknown user',
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: () => <input />,
  CommandItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/toggle-group', () => ({
  ToggleGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToggleGroupItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { EditingModeSelectorView } from '../EditingModeSelectorView';
import { RemoteCursorsSync } from '../RemoteCursorsSync';
import { SuggestionViewToggleView } from '../SuggestionViewToggleView';
import { AmendmentMetadata } from '../metadata/AmendmentMetadata';
import { BlogMetadata } from '../metadata/BlogMetadata';
import { DocumentMetadata } from '../metadata/DocumentMetadata';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const labels = {
  selectMode: 'Select',
  choiceMode: 'Choice',
  searchPlaceholder: 'Search',
  noResults: 'No results',
  allSuggestions: 'All suggestions',
  deselectAll: 'Deselect all',
  selectAll: 'Select all',
};

describe('editor P2 fallback branches A04', () => {
  it('uses the first editing mode for an absent current mode', () => {
    render(<EditingModeSelectorView onModeChange={vi.fn()} />);

    expect(
      screen.getAllByText('features.amendments.workflow.eventSuggesting').length
    ).toBeGreaterThan(0);
  });

  it('passes the default and explicit remote-cursor enabled states to the controller', () => {
    const view = render(<RemoteCursorsSync entityId="document-1" />);
    expect(remoteCursorState.controller).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true })
    );

    view.rerender(<RemoteCursorsSync entityId="document-1" enabled={false} />);
    expect(remoteCursorState.controller).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  it('renders empty avatar alt fallbacks for present avatars without names', () => {
    const amendment = render(
      <AmendmentMetadata collaborators={[{ id: 'a', user: { id: 'user-a', avatar: '/a.png' } }]} />
    );
    expect(amendment.container.textContent).toContain('Unknown user');
    amendment.unmount();

    const blog = render(
      <BlogMetadata bloggers={[{ id: 'b', user: { id: 'user-b', avatar: '/b.png' } }]} />
    );
    expect(blog.container.textContent).toContain('Unknown user');
    blog.unmount();

    const document = render(
      <DocumentMetadata
        owner={{ id: 'owner', avatar: '/owner.png' }}
        collaborators={[{ id: 'c', user: { id: 'user-c', avatar: '/c.png' } }]}
      />
    );
    expect(document.container.textContent).toContain('Unknown user');
  });

  it('falls back to the canonical suggestion id and evaluates selected aliases in both modes', () => {
    const option = {
      crId: 'CR-7',
      displayCrId: undefined as never,
      title: 'CR-7',
      userId: 'user-1',
      aliases: ['alias-7'],
    };
    const props = {
      selectedCrIds: new Set(['alias-7']),
      open: true,
      onOpenChange: vi.fn(),
      crOptions: [option],
      isFiltered: false,
      buttonLabel: 'Suggestions',
      allSelected: false,
      labels,
      onModeChange: vi.fn(),
      onSelectCr: vi.fn(),
      onToggleCr: vi.fn(),
      onSelectAll: vi.fn(),
      onDeselectAll: vi.fn(),
    };
    const view = render(<SuggestionViewToggleView {...props} filterMode="select" />);
    expect(screen.getByText('CR-7')).toBeTruthy();

    view.rerender(<SuggestionViewToggleView {...props} filterMode="choice" />);
    expect(screen.getByText('CR-7')).toBeTruthy();
  });
});

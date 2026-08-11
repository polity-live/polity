/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ selectorProps: null as any, mapProps: null as any }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#event">{children}</a>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock('@/features/amendments/ui/TargetGroupEventSelector', () => ({
  TargetGroupEventSelector: (props: any) => {
    mocks.selectorProps = props;
    return <div />;
  },
}));
vi.mock('@/features/amendments/ui/SupporterDirectoryDetails', () => ({
  SupporterDirectoryDetails: ({ item }: any) => <span>{item.name}</span>,
}));
vi.mock('@/features/amendments/ui/SupporterLocalityMap', () => ({
  SupporterLocalityMap: (props: any) => {
    mocks.mapProps = props;
    return <div>map</div>;
  },
}));

import { AmendmentForwardingNotice } from '../AmendmentForwardingNotice';
import { AmendmentSubscribeButtonView } from '../AmendmentSubscribeButtonView';
import { SupporterDirectorySectionView } from '../SupporterDirectorySectionView';
import { TargetSelectionDialogView } from '../TargetSelectionDialogView';

describe('small amendment views A04 branch accountability', () => {
  afterEach(cleanup);

  it('renders linked and unlinked forwarding destinations', () => {
    const preview = { status: 'pending', nextEventId: null, nextEventTitle: 'Event' } as any;
    const { rerender } = render(<AmendmentForwardingNotice preview={preview} />);
    expect(screen.queryByRole('link')).toBeNull();
    rerender(<AmendmentForwardingNotice preview={{ ...preview, nextEventId: 'event' }} />);
    expect(screen.getByRole('link')).toBeTruthy();
  });

  it('renders both subscription labels', () => {
    const base = {
      amendmentId: 'a',
      onSubscribeChange: vi.fn(),
      toggleSubscribe: vi.fn(),
      isLoading: false,
      handleClick: vi.fn(),
    } as any;
    const { rerender } = render(<AmendmentSubscribeButtonView {...base} isSubscribed={false} />);
    expect(screen.getByText('generated.inline.0170_subscribe_d6981f74')).toBeTruthy();
    rerender(<AmendmentSubscribeButtonView {...base} isSubscribed />);
    expect(screen.getByText('generated.inline.0169_unsubscribe_834cc0ee')).toBeTruthy();
  });

  it('passes or hides collaborators in the target dialog view', () => {
    const base = {
      open: true,
      onOpenChange: vi.fn(),
      currentUserId: 'user',
      collaborators: [{ id: 'one', name: 'One' }],
      isSaving: false,
      dialogTitle: 'Title',
      dialogDescription: 'Description',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onCancel: vi.fn(),
      onConfirmClick: vi.fn(),
      onTargetSelect: vi.fn(),
    } as any;
    const { rerender } = render(<TargetSelectionDialogView {...base} showCollaboratorSelection />);
    expect(mocks.selectorProps.collaborators).toHaveLength(1);
    rerender(<TargetSelectionDialogView {...base} showCollaboratorSelection={false} isSaving />);
    expect(mocks.selectorProps.collaborators).toEqual([]);
    expect((screen.getByText('Confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('returns no supporter section for empty items and renders map/no-map alternatives', () => {
    const handlers = {
      onActiveGroupChange: vi.fn(),
      onClearActiveGroup: vi.fn(),
      onSelect: vi.fn(),
    };
    const { container, rerender } = render(
      <SupporterDirectorySectionView
        {...handlers}
        activeGroupId={null}
        sortedItems={[]}
        sortedMapItems={[]}
        items={[]}
        mapItems={[]}
      />
    );
    expect(container.innerHTML).toBe('');
    const row = { groupId: 'group', name: 'Group' };
    rerender(
      <SupporterDirectorySectionView
        {...handlers}
        activeGroupId="group"
        sortedItems={[row]}
        sortedMapItems={[]}
        items={[]}
        mapItems={[]}
      />
    );
    expect(
      screen.getByText(
        'generated.inline.0174_no_supporter_groups_have_map_coordinates_yet_cf4e5eda'
      )
    ).toBeTruthy();
    const button = screen.getByTestId('supporter-directory-item-group');
    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);
    fireEvent.click(button);
    rerender(
      <SupporterDirectorySectionView
        {...handlers}
        activeGroupId={null}
        sortedItems={[row]}
        sortedMapItems={[row]}
        items={[]}
        mapItems={[]}
      />
    );
    expect(screen.getByText('map')).toBeTruthy();
  });
});

/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ networkProps: undefined as any }));
vi.mock('@/features/network/ui/CivicNetworkFlow', () => ({
  CivicNetworkFlow: (props: any) => {
    mocks.networkProps = props;
    return <div>network</div>;
  },
}));
vi.mock('@/features/amendments/ui/SupporterLocalityMap', () => ({
  SupporterLocalityMap: () => <div>map</div>,
}));
vi.mock('@/features/amendments/ui/SupporterDirectoryDetails', () => ({
  SupporterDirectoryDetails: () => <div>details</div>,
}));

import { AmendmentPathVisualizationView } from '../AmendmentPathVisualizationView';
import { SupporterDirectorySectionView } from '../SupporterDirectorySectionView';

afterEach(cleanup);

describe('amendment view LSF callbacks', () => {
  it('exposes an intentionally inert network interactivity adapter', () => {
    render(
      <AmendmentPathVisualizationView
        {...({
          amendmentId: 'a',
          t: (key: string) => key,
          nodes: [],
          edges: [],
          amendment: { group: { name: 'Group' }, event: { title: 'Event' } },
          hasTarget: true,
          pathSegments: [{ group_id: 'group-1' }],
        } as any)}
      />
    );
    expect(mocks.networkProps).toBeTruthy();
    expect(mocks.networkProps.panelConfig.onInteractiveChange()).toBeUndefined();
  });

  it('forwards directory focus and blur to active-group state', () => {
    const onActiveGroupChange = vi.fn();
    const onClearActiveGroup = vi.fn();
    const { getByTestId } = render(
      <SupporterDirectorySectionView
        {...({
          sortedItems: [{ groupId: 'group-1' }],
          sortedMapItems: [],
          activeGroupId: null,
          onActiveGroupChange,
          onClearActiveGroup,
          onSelect: vi.fn(),
        } as any)}
      />
    );
    const item = getByTestId('supporter-directory-item-group-1');
    fireEvent.focus(item);
    fireEvent.blur(item);
    expect(onActiveGroupChange).toHaveBeenCalledWith('group-1');
    expect(onClearActiveGroup).toHaveBeenCalledWith('group-1');
  });
});

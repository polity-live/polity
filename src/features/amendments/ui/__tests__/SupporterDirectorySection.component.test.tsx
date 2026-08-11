// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  SupporterDirectoryItem,
  SupporterMapItem,
} from '@/features/amendments/logic/supporterDirectory';
import { SupporterDirectorySection } from '@/features/amendments/ui/SupporterDirectorySection';
import { Button } from '@/features/shared/ui/ui/button';

const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/features/amendments/ui/SupporterLocalityMap', () => ({
  SupporterLocalityMap: ({
    items,
    activeGroupId,
    onHoverChange,
    onSelect,
  }: {
    items: readonly SupporterMapItem[];
    activeGroupId?: string | null;
    onHoverChange?: (groupId: string | null) => void;
    onSelect?: (groupId: string) => void;
  }) => (
    <div data-testid="mock-supporter-map">
      <div data-testid="active-marker">{activeGroupId ?? 'none'}</div>
      {items.map(item => (
        <Button
          key={item.groupId}
          type="button"
          data-testid={`marker-${item.groupId}`}
          onMouseEnter={() => onHoverChange?.(item.groupId)}
          onMouseLeave={() => onHoverChange?.(null)}
          onClick={() => onSelect?.(item.groupId)}
        >
          {item.name}
        </Button>
      ))}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  navigateMock.mockReset();
});

function createSupporterItem(overrides?: Partial<SupporterDirectoryItem>): SupporterDirectoryItem {
  return {
    groupId: overrides?.groupId ?? 'group-a',
    name: overrides?.name ?? 'Alpha Circle',
    href: overrides?.href ?? '/group/group-a',
    memberCount: overrides?.memberCount ?? 12,
    supportStatus: overrides?.supportStatus ?? 'active',
    locationLabel: overrides?.locationLabel ?? 'Berlin, Germany',
    latitude: overrides && 'latitude' in overrides ? (overrides.latitude ?? null) : 52.52,
    longitude: overrides && 'longitude' in overrides ? (overrides.longitude ?? null) : 13.405,
  };
}

describe('SupporterDirectorySection', () => {
  it('renders an alphabetical list and excludes no-coordinate groups from markers', () => {
    const items = [
      createSupporterItem({
        groupId: 'group-c',
        name: 'Zulu Assembly',
        href: '/group/group-c',
      }),
      createSupporterItem({
        groupId: 'group-a',
        name: 'Alpha Circle',
        href: '/group/group-a',
      }),
      createSupporterItem({
        groupId: 'group-b',
        name: 'Beta Forum',
        href: '/group/group-b',
        latitude: null,
        longitude: null,
      }),
    ];
    const mapItems = items.flatMap(item =>
      item.latitude !== null && item.longitude !== null
        ? [{ ...item, latitude: item.latitude, longitude: item.longitude }]
        : []
    );

    render(<SupporterDirectorySection items={items} mapItems={mapItems} />);

    const renderedItems = screen
      .getAllByTestId(/supporter-directory-item-/)
      .map(element => element.textContent ?? '');

    expect(renderedItems[0]).toContain('Alpha Circle');
    expect(renderedItems[1]).toContain('Beta Forum');
    expect(renderedItems[2]).toContain('Zulu Assembly');
    expect(screen.getByTestId('marker-group-a')).toBeTruthy();
    expect(screen.getByTestId('marker-group-c')).toBeTruthy();
    expect(screen.queryByTestId('marker-group-b')).toBeNull();
  });

  it('syncs hover state between the list and map markers', () => {
    const item = createSupporterItem();
    const mapItem: SupporterMapItem = {
      ...item,
      latitude: item.latitude ?? 52.52,
      longitude: item.longitude ?? 13.405,
    };

    render(<SupporterDirectorySection items={[item]} mapItems={[mapItem]} />);

    const listItem = screen.getByTestId('supporter-directory-item-group-a');

    fireEvent.mouseEnter(listItem);
    expect(screen.getByTestId('active-marker').textContent).toBe('group-a');

    fireEvent.mouseLeave(listItem);
    expect(screen.getByTestId('active-marker').textContent).toBe('none');

    fireEvent.mouseEnter(screen.getByTestId('marker-group-a'));
    expect(listItem.className).toContain('border-primary');
  });

  it('navigates to the group when the list row or marker is clicked', () => {
    const item = createSupporterItem();
    const mapItem: SupporterMapItem = {
      ...item,
      latitude: item.latitude ?? 52.52,
      longitude: item.longitude ?? 13.405,
    };

    render(<SupporterDirectorySection items={[item]} mapItems={[mapItem]} />);

    fireEvent.click(screen.getByTestId('supporter-directory-item-group-a'));
    fireEvent.click(screen.getByTestId('marker-group-a'));

    expect(navigateMock).toHaveBeenNthCalledWith(1, {
      to: '/group/$id',
      params: { id: 'group-a' },
    });
    expect(navigateMock).toHaveBeenNthCalledWith(2, {
      to: '/group/$id',
      params: { id: 'group-a' },
    });
  });
});

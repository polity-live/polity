import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigationView: 'asButton' as string,
  navigationType: 'primary' as string,
  isMobileScreen: false,
  secondaryNavItems: undefined as undefined | { id: string }[],
}));

vi.mock('@/features/navigation/state/navigation.store', () => ({
  useNavigationStore: () => ({
    navigationView: mocks.navigationView,
    navigationType: mocks.navigationType,
  }),
}));

vi.mock('@/features/shared/global-state/screen.store', () => ({
  useScreenStore: () => ({ isMobileScreen: mocks.isMobileScreen }),
}));

vi.mock('@/features/navigation/state/useNavigation', () => ({
  useNavigation: () => ({ secondaryNavItems: mocks.secondaryNavItems }),
}));

vi.mock('@/features/shared/utils/utils', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));

import { useFixedAgendaToolbarController } from '../useFixedAgendaToolbarController';

function classes(className?: string) {
  return useFixedAgendaToolbarController(className).className.split(' ');
}

beforeEach(() => {
  mocks.navigationView = 'asButton';
  mocks.navigationType = 'primary';
  mocks.isMobileScreen = false;
  mocks.secondaryNavItems = undefined;
});

describe('useFixedAgendaToolbarController', () => {
  it.each([
    {
      label: 'mobile button without secondary navigation',
      mobile: true,
      view: 'asButton',
      type: 'primary',
      items: undefined,
      expected: ['top-0', 'left-0', 'right-0', 'w-full'],
    },
    {
      label: 'mobile button list with secondary navigation',
      mobile: true,
      view: 'asButtonList',
      type: 'secondary',
      items: [{ id: 'secondary' }],
      expected: ['top-16', 'left-0', 'right-0', 'w-full'],
    },
    {
      label: 'mobile labeled list with combined navigation',
      mobile: true,
      view: 'asLabeledButtonList',
      type: 'combined',
      items: [{ id: 'secondary' }],
      expected: ['top-20', 'left-0', 'right-0', 'w-full'],
    },
    {
      label: 'desktop button list without secondary navigation',
      mobile: false,
      view: 'asButtonList',
      type: 'primary',
      items: [{ id: 'secondary' }],
      expected: ['top-0', 'left-16', 'right-0', 'w-[calc(100%-64px)]'],
    },
    {
      label: 'desktop labeled list without secondary navigation',
      mobile: false,
      view: 'asLabeledButtonList',
      type: 'primary',
      items: [],
      expected: ['top-0', 'left-64', 'right-0', 'w-[calc(100%-256px)]'],
    },
    {
      label: 'desktop button list with secondary navigation',
      mobile: false,
      view: 'asButtonList',
      type: 'secondary',
      items: [{ id: 'secondary' }],
      expected: ['top-0', 'left-16', 'right-16', 'w-[calc(100%-128px)]'],
    },
    {
      label: 'desktop labeled list with secondary navigation',
      mobile: false,
      view: 'asLabeledButtonList',
      type: 'combined',
      items: [{ id: 'secondary' }],
      expected: ['top-0', 'left-64', 'right-64', 'w-[calc(100%-512px)]'],
    },
    {
      label: 'desktop compact button with secondary navigation',
      mobile: false,
      view: 'asButton',
      type: 'secondary',
      items: [{ id: 'secondary' }],
      expected: ['top-0', 'left-0', 'right-0', 'w-full'],
    },
    {
      label: 'desktop unknown view with secondary navigation',
      mobile: false,
      view: 'custom',
      type: 'secondary',
      items: [{ id: 'secondary' }],
      expected: ['top-0', 'left-0', 'right-0', 'w-full'],
    },
    {
      label: 'mobile unknown view with secondary navigation',
      mobile: true,
      view: 'custom',
      type: 'secondary',
      items: [{ id: 'secondary' }],
      expected: ['top-0', 'left-0', 'right-0', 'w-full'],
    },
  ])('$label', ({ mobile, view, type, items, expected }) => {
    mocks.isMobileScreen = mobile;
    mocks.navigationView = view;
    mocks.navigationType = type;
    mocks.secondaryNavItems = items;

    const result = classes('consumer-class');

    expect(result).toEqual(expect.arrayContaining([...expected, 'consumer-class']));
  });
});

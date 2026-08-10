import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigationView: 'asButton' as string,
  navigationType: 'primary' as string,
  isMobileScreen: false,
  secondaryNavItems: undefined as undefined | { id: string }[],
}));

vi.mock('@/features/navigation/state/navigation.store.tsx', () => ({
  useNavigationStore: () => ({
    navigationView: mocks.navigationView,
    navigationType: mocks.navigationType,
  }),
}));

vi.mock('@/features/navigation/state/useNavigation.tsx', () => ({
  useNavigation: () => ({ secondaryNavItems: mocks.secondaryNavItems }),
}));

vi.mock('@/features/shared/hooks/useIsMobileScreen', () => ({
  useIsMobileScreen: () => mocks.isMobileScreen,
}));

vi.mock('@/features/shared/utils/utils.ts', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));

import {
  getFixedToolbarLayoutClasses,
  useFixedToolbarController,
} from '../useFixedToolbarController';

beforeEach(() => {
  mocks.navigationView = 'asButton';
  mocks.navigationType = 'primary';
  mocks.isMobileScreen = false;
  mocks.secondaryNavItems = undefined;
});

describe('getFixedToolbarLayoutClasses', () => {
  it.each([
    [true, false, 'asButton', ['top-0', 'left-0', 'right-0', 'w-full']],
    [true, true, 'asButtonList', ['top-16', 'left-0', 'right-0', 'w-full']],
    [true, true, 'asLabeledButtonList', ['top-20', 'left-0', 'right-0', 'w-full']],
    [true, true, 'custom', ['top-0', 'left-0', 'right-0', 'w-full']],
    [false, false, 'asButtonList', ['top-0', 'left-16', 'right-0', 'w-[calc(100%-64px)]']],
    [false, false, 'asLabeledButtonList', ['top-0', 'left-64', 'right-0', 'w-[calc(100%-256px)]']],
    [false, true, 'asButtonList', ['top-0', 'left-16', 'right-16', 'w-[calc(100%-128px)]']],
    [false, true, 'asLabeledButtonList', ['top-0', 'left-64', 'right-64', 'w-[calc(100%-512px)]']],
    [false, true, 'custom', ['top-0', 'left-0', 'right-0', 'w-full']],
  ])(
    'maps mobile=%s secondary=%s view=%s to deterministic layout classes',
    (isMobileScreen, isSecondaryNavVisible, navigationView, expected) => {
      expect(
        getFixedToolbarLayoutClasses({
          isMobileScreen,
          isSecondaryNavVisible,
          navigationView,
        })
      ).toEqual(expected);
    }
  );
});

describe('useFixedToolbarController', () => {
  it.each([
    [undefined, 'primary', 'asButton', 'top-0'],
    [[], 'secondary', 'asButtonList', 'right-0'],
    [[{ id: 'secondary' }], 'primary', 'asButtonList', 'right-0'],
    [[{ id: 'secondary' }], 'secondary', 'asButtonList', 'right-16'],
    [[{ id: 'secondary' }], 'combined', 'asLabeledButtonList', 'right-64'],
  ] as const)(
    'derives secondary visibility for items=%j type=%s',
    (items, type, view, expected) => {
      mocks.secondaryNavItems = items ? [...items] : undefined;
      mocks.navigationType = type;
      mocks.navigationView = view;

      const className = useFixedToolbarController('consumer-class').className;

      expect(className.split(' ')).toContain(expected);
      expect(className).toContain('consumer-class');
    }
  );
});

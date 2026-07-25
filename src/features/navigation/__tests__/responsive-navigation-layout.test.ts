import { describe, expect, it } from 'vitest';

import {
  getDesktopNavigationVisibilityClasses,
  getListNavigationContainerClasses,
  getMobileNavigationVisibilityClasses,
} from '../responsive-navigation-layout';

describe('responsive navigation layout', () => {
  it('uses mobile-first classes with desktop breakpoint overrides in automatic mode', () => {
    const primary = getListNavigationContainerClasses({
      navigationType: 'primary',
      navigationView: 'asButtonList',
      screenType: 'automatic',
    });
    const secondary = getListNavigationContainerClasses({
      navigationType: 'secondary',
      navigationView: 'asLabeledButtonList',
      screenType: 'automatic',
    });

    expect(primary).toContain('bottom-0');
    expect(primary).toContain('md:top-0');
    expect(primary).toContain('md:w-16');
    expect(secondary).toContain('top-0');
    expect(secondary).toContain('md:left-auto');
    expect(secondary).toContain('md:w-64');
    expect(getMobileNavigationVisibilityClasses('automatic')).toBe('flex md:hidden');
    expect(getDesktopNavigationVisibilityClasses('automatic')).toBe('hidden md:flex');
  });

  it('does not add breakpoint overrides to forced screen modes', () => {
    const mobile = getListNavigationContainerClasses({
      navigationType: 'primary',
      navigationView: 'asButtonList',
      screenType: 'mobile',
    });
    const desktop = getListNavigationContainerClasses({
      navigationType: 'secondary',
      navigationView: 'asLabeledButtonList',
      screenType: 'desktop',
    });

    expect(mobile).not.toContain('md:');
    expect(mobile).toContain('bottom-0');
    expect(desktop).not.toContain('md:');
    expect(desktop).toContain('w-64');
    expect(desktop).toContain('border-l');
  });
});

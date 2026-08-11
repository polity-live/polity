import { describe, expect, it } from 'vitest';

import {
  getDesktopNavigationVisibilityClasses,
  getListNavigationContainerClasses,
  getListNavigationContentClasses,
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

  it('covers every forced visibility and container orientation', () => {
    expect(getMobileNavigationVisibilityClasses('mobile')).toBe('flex');
    expect(getMobileNavigationVisibilityClasses('desktop')).toBe('hidden');
    expect(getDesktopNavigationVisibilityClasses('mobile')).toBe('hidden');
    expect(getDesktopNavigationVisibilityClasses('desktop')).toBe('flex');

    for (const screenType of ['mobile', 'desktop', 'automatic'] as const) {
      for (const navigationType of ['primary', 'secondary'] as const) {
        for (const navigationView of ['asButtonList', 'asLabeledButtonList'] as const) {
          expect(
            getListNavigationContainerClasses({
              navigationType,
              navigationView,
              screenType,
            })
          ).toContain('bg-background');
        }
      }
    }
  });

  it('covers content sizing for every screen and list view', () => {
    for (const screenType of ['mobile', 'desktop', 'automatic'] as const) {
      for (const navigationView of ['asButtonList', 'asLabeledButtonList'] as const) {
        expect(getListNavigationContentClasses({ navigationView, screenType })).toContain(
          screenType === 'mobile' ? 'overflow-hidden' : 'overflow-y-auto'
        );
      }
    }
  });
});

/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Tabs, TabsList, TabsTrigger } from '../tabs';

afterEach(() => {
  cleanup();
});

describe('TabsList', () => {
  it('hides scrollbars while allowing horizontal overflow', () => {
    render(
      <Tabs defaultValue="one">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    const tabsList = screen.getByTestId('tabs-list');

    expect(tabsList.className).toContain('scrollbar-hide');
    expect(tabsList.className).toContain('min-w-0');
    expect(tabsList.className).toContain('max-w-full');
    expect(tabsList.className).toContain('min-h-10');
    expect(tabsList.className).toContain('overflow-x-auto');
    expect(tabsList.className).toContain('overflow-y-hidden');
    expect(tabsList.className).toContain('overscroll-x-contain');
    expect(tabsList.className).toContain('justify-start');
  });

  it('keeps caller layout overrides compatible', () => {
    render(
      <Tabs defaultValue="manual">
        <TabsList className="grid w-full grid-cols-2 justify-center" data-testid="tabs-list">
          <TabsTrigger value="manual">Manual</TabsTrigger>
          <TabsTrigger value="official">Official</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    const tabsList = screen.getByTestId('tabs-list');

    expect(tabsList.className).toContain('grid');
    expect(tabsList.className).toContain('w-full');
    expect(tabsList.className).toContain('grid-cols-2');
    expect(tabsList.className).toContain('justify-center');
  });
});

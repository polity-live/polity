/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { GroupTypeSection } from '../GroupTypeSection';

afterEach(() => {
  cleanup();
});

describe('GroupTypeSection', () => {
  it('shows a newly created hierarchical group without hierarchy children as hierarchical', () => {
    render(
      <GroupTypeSection
        groupType="hierarchical"
        hasHierarchyChildren={false}
        hasSiblingConnections={false}
      />
    );

    expect(screen.getByText('Hierarchical Group')).toBeTruthy();
    expect(screen.queryByText('Base Group')).toBeNull();
  });

  it('shows hierarchy and sibling badges for mixed-structure groups', () => {
    render(
      <GroupTypeSection groupType="hierarchical" hasHierarchyChildren hasSiblingConnections />
    );

    expect(screen.getByText('Hierarchical Group')).toBeTruthy();
    expect(screen.getByText('Geschwistergruppe')).toBeTruthy();
    expect(screen.queryByText('Base Group')).toBeNull();
  });

  it('keeps base as the primary type when a base group has sibling connections', () => {
    render(<GroupTypeSection groupType="base" hasSiblingConnections />);

    expect(screen.getByText('Base Group')).toBeTruthy();
    expect(screen.getByText('Geschwistergruppe')).toBeTruthy();
  });
});

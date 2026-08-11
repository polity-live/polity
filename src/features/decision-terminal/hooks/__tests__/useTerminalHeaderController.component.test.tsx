/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTerminalHeaderController } from '../useTerminalHeaderController';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('useTerminalHeaderController', () => {
  it.each([
    ['all', 'features.timeline.terminal.visibility.all'],
    ['public', 'features.timeline.terminal.visibility.public'],
    ['authenticated', 'features.timeline.terminal.visibility.authenticated'],
    ['private', 'features.timeline.terminal.visibility.private'],
  ] as const)('maps the %s visibility label', (visibilityFilter, label) => {
    const { result } = renderHook(() =>
      useTerminalHeaderController({ visibilityFilter, searchQuery: '' })
    );
    expect(result.current.visibilityLabel).toBe(label);
    expect(result.current.filters).toHaveLength(4);
  });

  it('opens search and closes it only when the query is empty', () => {
    const { result, rerender } = renderHook(
      ({ searchQuery }) => useTerminalHeaderController({ visibilityFilter: 'all', searchQuery }),
      { initialProps: { searchQuery: '' } }
    );
    act(() => result.current.onShowSearch());
    expect(result.current.showSearch).toBe(true);
    act(() => result.current.onSearchBlur());
    expect(result.current.showSearch).toBe(false);

    rerender({ searchQuery: 'budget' });
    act(() => result.current.onShowSearch());
    act(() => result.current.onSearchBlur());
    expect(result.current.showSearch).toBe(true);
  });
});

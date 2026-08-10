/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GroupsFilters } from '../GroupsFilters';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe('GroupsFilters actions', () => {
  it('dispatches search, tag, and clear effects through stable controls', () => {
    const setSearchTerm = vi.fn();
    const toggleTag = vi.fn();
    const clearAllFilters = vi.fn();
    const { container } = render(
      <GroupsFilters
        searchTerm=""
        setSearchTerm={setSearchTerm}
        selectedTags={[]}
        setSelectedTags={vi.fn()}
        toggleTag={toggleTag}
        allTags={['local']}
        hasActiveFilters
        clearAllFilters={clearAllFilters}
      />
    );

    fireEvent.change(container.querySelector('input')!, { target: { value: 'assembly' } });
    const tag = container.querySelector<HTMLElement>(
      '[data-action-id="groups.list.filters.toggle-tag"]'
    )!;
    tag.focus();
    expect(document.activeElement).toBe(tag);
    fireEvent.click(tag);
    fireEvent.click(container.querySelector('[data-action-id="groups.list.filters.clear-all"]')!);
    expect(setSearchTerm).toHaveBeenCalledWith('assembly');
    expect(toggleTag).toHaveBeenCalledWith('local');
    expect(clearAllFilters).toHaveBeenCalledTimes(1);
  });
});

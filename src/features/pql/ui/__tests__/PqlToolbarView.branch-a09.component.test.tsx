// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PqlToolbarView } from '../PqlToolbarView';

const mocks = vi.hoisted(() => ({ typeahead: [] as any[], hashtags: [] as any[] }));

vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, asChild: _asChild, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('@/features/shared/ui/filter-controls', () => ({
  FilterButton: ({ children, active: _active, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('@/features/shared/ui/status/StatusBadges', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/form', () => ({
  SearchField: ({ onValueChange }: any) => (
    <button onClick={() => onValueChange('searched')}>search-field</button>
  ),
  FormControlInput: (props: any) => <input aria-label="date-filter" {...props} />,
}));
vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: (props: any) => {
    mocks.typeahead.push(props);
    return <div data-testid="typeahead" />;
  },
}));
vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagInput: (props: any) => {
    mocks.hashtags.push(props);
    return <button onClick={() => props.onChange(['next-tag'])}>hashtag</button>;
  },
}));
vi.mock('@/features/shared/ui/ui/collapsible', () => ({
  Collapsible: ({ children }: any) => <>{children}</>,
  CollapsibleContent: ({ children }: any) => <>{children}</>,
  CollapsibleTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children, ...props }: any) => <section {...props}>{children}</section>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/layout/SurfaceDepthContext', () => ({
  useResolvedSurfaceMode: (surface: string) => (surface === 'embedded' ? 'embedded' : 'standalone'),
}));
vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: () => 'contrast' }));
vi.mock('@/features/shared/utils/utils', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { entity?: string }) => `${key}:${values?.entity ?? ''}`,
  }),
  translate: (key: string) => key,
}));
vi.mock('../PqlFilterBuilderDialog', () => ({ PqlFilterBuilderDialog: () => <aside /> }));
vi.mock('@/features/pql/logic/applyPqlFilter', async importOriginal => {
  const actual = await importOriginal<any>();
  return { ...actual, serializePqlFilter: (filter: any) => filter.query ?? '' };
});

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    activeBadges: [],
    activeCustomFilterIds: [],
    activeQuickBadgeCount: 0,
    builderOpen: false,
    customFiltersOpen: false,
    editingFilter: null,
    fieldFiltersOpen: false,
    fields: [],
    onBuilderOpenChange: vi.fn(),
    onCustomFilterDelete: vi.fn(),
    onCustomFilterSave: vi.fn(),
    onCustomFilterToggle: vi.fn(),
    onCustomFiltersOpenChange: vi.fn(),
    onEditFilter: vi.fn(),
    onFieldFiltersOpenChange: vi.fn(),
    onQuickFilterClear: vi.fn(),
    onQuickFilterToggle: vi.fn(),
    onQuickFilterValuesChange: vi.fn(),
    onSearchQueryChange: vi.fn(),
    quickFilters: [],
    quickFilterValues: {},
    savedFilters: [],
    searchPlaceholder: 'Search',
    searchQuery: '',
    ...overrides,
  } as any;
}

describe('PqlToolbarView branch coverage', () => {
  afterEach(() => {
    cleanup();
    mocks.typeahead = [];
    mocks.hashtags = [];
  });

  it('renders the minimal embedded toolbar and an active saved filter', () => {
    render(
      <PqlToolbarView
        {...baseProps({
          surface: 'embedded',
          activeCustomFilterIds: ['active'],
          savedFilters: [{ id: 'active', label: 'Active filter', query: 'status = active' }],
        })}
      />
    );
    expect(document.querySelector('[data-surface="embedded"]')).toBeTruthy();
    expect(document.body.textContent).toContain('generated.inline.0126_active_a733b809');
    expect(document.body.textContent).toContain('generated.inline.0135_applied_a3e4a569');
    expect(document.querySelector('[data-slot="pql-actions"]')).toBeNull();
    expect(
      document.querySelector('[data-action-id="pql.toolbar.field-filters.toggle"]')
    ).toBeNull();
  });

  it('covers all typeahead, hashtag, date, option and label fallbacks', () => {
    const onValues = vi.fn();
    const onToggle = vi.fn();
    render(
      <PqlToolbarView
        {...baseProps({
          fieldFiltersOpen: true,
          onQuickFilterValuesChange: onValues,
          onQuickFilterToggle: onToggle,
          fields: [
            {
              key: 'single',
              label: 'Single field',
              options: [{ value: 'one', label: 'One' }],
            },
            {
              key: 'hashtags',
              label: 'Hash field',
              options: [{ value: 'suggestion', label: 'Suggestion' }],
            },
            {
              key: 'buttons',
              label: 'Button field',
              options: [
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ],
            },
          ],
          quickFilters: [
            { fieldKey: 'missingMultiple', inputKind: 'typeahead', multiple: true },
            {
              fieldKey: 'single',
              inputKind: 'typeahead',
              typeaheadItems: [{ id: 'one', label: 'One' }],
            },
            { fieldKey: 'missingSingle', label: 'Named single', inputKind: 'typeahead' },
            { fieldKey: 'emptySingle', inputKind: 'typeahead' },
            { fieldKey: 'hashtags', inputKind: 'hashtag' },
            { fieldKey: 'explicitHash', inputKind: 'hashtag', placeholder: 'Explicit hash' },
            { fieldKey: 'emptyDate', inputKind: 'date' },
            { fieldKey: 'fullDate', inputKind: 'date' },
            { fieldKey: 'buttons' },
          ],
          quickFilterValues: {
            single: ['one'],
            fullDate: ['2026-08-09'],
            buttons: ['yes'],
          },
        })}
      />
    );

    expect(mocks.typeahead).toHaveLength(4);
    expect(mocks.typeahead[0]).toEqual(
      expect.objectContaining({ items: [], multiple: true, values: [] })
    );
    expect(mocks.typeahead[0].placeholder).toContain(':');
    mocks.typeahead[0].onValuesChange(['multi']);
    expect(mocks.typeahead[1]).toEqual(expect.objectContaining({ value: 'one' }));
    mocks.typeahead[1].onChange({ id: 'one' });
    mocks.typeahead[1].onChange(null);
    expect(mocks.typeahead[2].placeholder).toContain('Named single');
    expect(mocks.typeahead[3].placeholder).toBe('common.accessibility.search:');

    fireEvent.click(screen.getAllByRole('button', { name: 'hashtag' })[0]);
    expect(mocks.hashtags[0].suggestions).toEqual(['suggestion']);
    expect(mocks.hashtags[0].placeholder).toBe('common.accessibility.addTag:');
    expect(mocks.hashtags[1].placeholder).toBe('Explicit hash');

    const dateInputs = screen.getAllByLabelText('date-filter');
    expect(dateInputs[0].getAttribute('value')).toBe('');
    expect(dateInputs[1].getAttribute('value')).toBe('2026-08-09');
    fireEvent.change(dateInputs[0], { target: { value: '2026-09-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'No' }));

    expect(onValues).toHaveBeenCalledWith('missingMultiple', ['multi']);
    expect(onValues).toHaveBeenCalledWith('single', ['one']);
    expect(onValues).toHaveBeenCalledWith('single', []);
    expect(onValues).toHaveBeenCalledWith('emptyDate', ['2026-09-01']);
    expect(onValues).toHaveBeenCalledWith('fullDate', []);
    expect(onToggle).toHaveBeenCalledWith('buttons', 'no');
  });
});

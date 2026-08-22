import { describe, expect, it } from 'vitest';

import { dataTableFeatures } from '../dataTableFeatures';

describe('dataTableFeatures', () => {
  it('registers the complete shared filtering, sorting, pagination, selection, and visibility contract', () => {
    expect(dataTableFeatures).toMatchObject({
      columnFilteringFeature: expect.any(Object),
      columnVisibilityFeature: expect.any(Object),
      filteredRowModel: expect.any(Function),
      globalFilteringFeature: expect.any(Object),
      paginatedRowModel: expect.any(Function),
      rowPaginationFeature: expect.any(Object),
      rowSelectionFeature: expect.any(Object),
      rowSortingFeature: expect.any(Object),
      sortedRowModel: expect.any(Function),
    });
    expect(Object.keys(dataTableFeatures.filterFns ?? {}).sort()).toEqual([
      'arrIncludes',
      'equals',
      'inDateRange',
      'inNumberRange',
      'includesString',
      'weakEquals',
    ]);
    expect(Object.keys(dataTableFeatures.sortFns ?? {}).sort()).toEqual([
      'alphanumeric',
      'datetime',
      'text',
    ]);
  });
});

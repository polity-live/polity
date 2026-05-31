# Shared Typeahead Search Component

Reusable typeahead search for selecting shared entities across dialogs, settings pages, and create flows.

## Supported Entity Types

Single-entity and mixed search support:

- `event`
- `group`
- `amendment`
- `user`
- `blog`
- `todo`
- `vote`
- `election`
- `agenda_item`

Mixed search across those nine entity types is available via `ALL_TYPEAHEAD_ENTITY_TYPES`.

`role` remains supported for explicit role pickers, but it is intentionally excluded from `ALL_TYPEAHEAD_ENTITY_TYPES`.

## Usage

Single select:

```tsx
import { TypeaheadSearch } from '@/features/shared/ui/typeahead';

function GroupPicker() {
  const [selectedId, setSelectedId] = useState<string>('');

  return (
    <TypeaheadSearch
      entityTypes={['group']}
      value={selectedId}
      onChange={item => setSelectedId(item?.id ?? '')}
      placeholder="Search groups..."
    />
  );
}
```

Multi select:

```tsx
import { TypeaheadSearch } from '@/features/shared/ui/typeahead';

function UserPicker() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <TypeaheadSearch
      entityTypes={['user']}
      multiple
      values={selectedIds}
      onValuesChange={setSelectedIds}
      placeholder="Search users..."
    />
  );
}
```

Mixed search:

```tsx
import { ALL_TYPEAHEAD_ENTITY_TYPES, TypeaheadSearch } from '@/features/shared/ui/typeahead';

<TypeaheadSearch
  entityTypes={[...ALL_TYPEAHEAD_ENTITY_TYPES]}
  value={selectedId}
  onChange={item => setSelectedId(item?.id ?? '')}
  placeholder="Search across all supported entities..."
/>;
```

## Selection UX

- Single select renders a compact selected card inside the field, with an `X` button to clear it.
- Multi select keeps the search input visible and renders selected entity cards as a stacked list below it.
- Selected cards are display-only and mirror the shared search/timeline card language.

## Props

Shared props:

- `entityTypes`
- `items`
- `filterFn`
- `placeholder`
- `disablePortal`
- `showAllResults`

Single-select props:

- `value?: string`
- `onChange(item | null)`

Multi-select props:

- `multiple: true`
- `values: string[]`
- `onValuesChange(nextIds: string[])`

## Architecture

```text
TypeaheadSearch.tsx         - Main component (input + selected cards + dropdown)
├── TypeaheadSelectedCard.tsx - Compact/stacked selected entity cards
├── TypeaheadDropdown.tsx   - Grouped dropdown container
│   └── TypeaheadResultCard.tsx - Individual result row
├── useTypeaheadSearch.ts   - Query state + filtering + grouped results
│   └── useTypeaheadData.ts - Shared data loading for supported entity types
├── typeaheadHelpers.ts     - Entity constants, filtering, sorting, selection helpers
└── entityCardHelpers.ts    - Shared entity icons and gradients
```

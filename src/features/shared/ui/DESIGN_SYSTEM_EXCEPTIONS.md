# Design System Exceptions

The app layer should compose shared design-system components from `src/features/shared/ui`.
Direct shadcn primitives in feature views are only allowed for the narrow cases below.

## Foundation Inventory

The local shadcn alias is `@/features/shared/ui/ui` via `components.json`. The current official
component baseline is the shadcn components index: <https://ui.shadcn.com/docs/components>.

| Group                                    | Local files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shadcn-aligned primitives                | `accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `button-group`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `empty`, `field`, `form`, `hover-card`, `input`, `input-group`, `input-otp`, `item`, `kbd`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `spinner`, `switch`, `table`, `tabs`, `textarea`, `toggle`, `toggle-group`, `tooltip` |
| shadcn-near local primitives             | `native-select`, `visually-hidden`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Composition compatibility shims          | `ActionBar`, `StatsBar`, `SubscriberStatsBar`, `contact-dialog`, `create-review-card`, `editing-mode`, `entity-search-bar`, `entity-select-cards`, `hashtag-display`, `hashtag-editor`, `hashtag-input`, `inline-combobox`, `not-found`, `resize-handle`, `scrollable-tabs`, `table-tag`, `toolbar`, `type-selector`, `user-select-card`, `user-table-cell`, `visibility-selector`                                                                                                                                                                                                                                                       |
| Intentionally deferred from shadcn index | `combobox` stays separate from the Plate-specific `inline-combobox`; `direction` is documented only until RTL app wiring exists; `toast` is not added because shadcn marks it deprecated in favor of `sonner`; `date-picker` and `data-table` remain composition patterns built from local primitives.                                                                                                                                                                                                                                                                                                                                   |

`src/features/shared/ui/ui/*` should contain primitives only. If a file in that folder imports
from a shared composition folder, it is a temporary compatibility shim and should not receive
new behavior.

## Allowed Exceptions

- `src/features/charts/ui/ManualChartTableEditor.tsx`
  - Spreadsheet-style editor for chart source data.
  - Uses shadcn `Table` and `Input` primitives directly because cells are editable controls, not read-only app data rows.
  - Keep this exception isolated from `ChartDialog.tsx`.

- `src/features/flow-editor/PositionableEdge.tsx` and `src/features/network/ui/RightsLabelEdge.tsx`
  - XYFlow edge labels and bend-point controls render inside SVG/overlay edge layers where shadcn `Button` sizing and focus styles break pointer geometry.
  - Native buttons are allowed only for edge-label and bend-point handles.
  - Keep `type="button"`, accessible labels, visible focus styles, and keyboard movement/removal support on every handle.

- Native browser file picker inputs
  - Hidden native `<input type="file">` controls are allowed because the browser file picker API requires a real file input.
  - The hidden input should live inside `FileUploadTrigger` or `FileInputField`; feature-local hidden inputs are migration debt, not permanent exceptions.
  - Visible triggers must remain shared `Button`/form components.

- `src/features/shared/ui/**`
  - Shared primitives and compositions may wrap shadcn primitives directly.
  - App-specific shared components should live outside `src/features/shared/ui/ui`.
  - Non-Plate shared UI must not import from feature modules outside `src/features/shared`.
  - Shared UI components should be presentational or UI-state-only: no Zero hooks, no mutation hooks, and no feature-specific orchestration.

- `src/features/shared/ui/ui-platejs/**` and `src/features/shared/ui/kit-platejs/**`
  - Plate/editor internals may use low-level editor and table primitives where the editor framework requires them.
  - Plate/editor internals may keep using the compatibility shims for `toolbar`, `inline-combobox`, `resize-handle`, and `editing-mode` during the editor refactor stream.
  - Plate/editor internals may keep temporary feature adapters for chart, media, navigation, and editor integration until the editor workstream replaces them.

## Rule Of Thumb

If a feature view renders a form, dialog, table, badge, panel, empty state, loading state, or error state, use the shared composition layer first.

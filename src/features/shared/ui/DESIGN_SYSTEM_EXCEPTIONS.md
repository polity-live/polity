# Design System Exceptions

The app layer should compose shared design-system components from `src/features/shared/ui`.
Direct shadcn primitives in feature views are only allowed for the narrow cases below.

## Allowed Exceptions

- `src/features/charts/ui/ManualChartTableEditor.tsx`
  - Spreadsheet-style editor for chart source data.
  - Uses shadcn `Table` and `Input` primitives directly because cells are editable controls, not read-only app data rows.
  - Keep this exception isolated from `ChartDialog.tsx`.

- Local round markers and compact people/count pills
  - These are layout indicators, not semantic status badges.
  - Allowed current files: `AgendaItemContextCard.tsx`, `ChartDialog.tsx`, `CreateProgressIndicator.tsx`, `RecurringPatternInput.tsx`, `EditorHeader.tsx`, `SharedChronologicalListView.tsx`, `SharedMonthView.tsx`, `MeetingCalendarViews.tsx`, `ConversationItem.tsx`, `NotificationSettingsPage.tsx`, `SettingItem.tsx`, `SubscriptionPlansGrid.tsx`, `ActionTimelineCard.tsx`, `ElectionTimelineCard.tsx`, `ReasonTooltip.tsx`, `TodoTimelineCard.tsx`, `users/wiki.tsx`, `VoteControls.tsx`.
  - When a marker communicates entity status, phase, priority, role, or count outside a compact control, prefer `StatusBadge`, `StateBadge`, `PhaseBadge`, `PriorityBadge`, `RoleBadge`, `CountBadge`, or `TokenBadge`.

- `src/features/shared/ui/**`
  - Shared primitives and compositions may wrap shadcn primitives directly.

- `src/features/shared/ui/ui-platejs/**` and `src/features/shared/ui/kit-platejs/**`
  - Plate/editor internals may use low-level editor and table primitives where the editor framework requires them.

## Rule Of Thumb

If a feature view renders a form, dialog, table, badge, panel, empty state, loading state, or error state, use the shared composition layer first.

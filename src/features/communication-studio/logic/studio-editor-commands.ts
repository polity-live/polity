import type { StudioThemeSnapshot } from './theme';
import type { TableDimensions } from './table-operations';

export function selectStudioEditorTheme({
  themes,
  themeId,
  current,
  apply,
}: {
  themes: readonly StudioThemeSnapshot[];
  themeId: string;
  current: StudioThemeSnapshot | undefined;
  apply: (theme: StudioThemeSnapshot) => void;
}) {
  const theme = themes.find(item => item.themeId === themeId);
  if (theme) apply({ ...theme, mode: current?.mode ?? 'light' });
}

export function insertStudioEditorTable({
  dimensions,
  insert,
  inserted,
}: {
  dimensions: TableDimensions;
  insert: (dimensions: TableDimensions) => string | null;
  inserted: () => void;
}) {
  const id = insert(dimensions);
  if (id) inserted();
}

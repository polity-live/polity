import * as React from 'react';

import type { ParsedChartTable } from '../logic/chartData';
interface ManualChartTableEditorProps {
  table: ParsedChartTable;
  onChange: (table: ParsedChartTable) => void;
  readOnly?: boolean;
}
import { useManualChartTableEditorController } from './useManualChartTableEditorController';
import { ManualChartTableEditorView } from './ManualChartTableEditorView';

export function ManualChartTableEditor({
  table,
  onChange,
  readOnly = false,
}: ManualChartTableEditorProps) {
  const viewProps = useManualChartTableEditorController({ table, onChange, readOnly });

  return <ManualChartTableEditorView {...viewProps} />;
}

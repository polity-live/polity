import * as React from 'react';

import type { ParsedChartTable } from '../logic/chartData';
interface ManualChartTableEditorProps {
  table: ParsedChartTable;
  onChange: (table: ParsedChartTable) => void;
}
import { useManualChartTableEditorController } from './useManualChartTableEditorController';
import { ManualChartTableEditorView } from './ManualChartTableEditorView';

export function ManualChartTableEditor({ table, onChange }: ManualChartTableEditorProps) {
  const viewProps = useManualChartTableEditorController({ table, onChange });

  return <ManualChartTableEditorView {...viewProps} />;
}

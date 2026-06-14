import type { PlateElementProps } from 'platejs/react';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { PlateElement, useEditorRef, useFocused, useReadOnly, useSelected } from 'platejs/react';
import { useTranslation } from 'react-i18next';
import type { TChartElement } from '@/features/charts/types';
import { ChartRenderer } from '@/features/charts/ui/ChartRenderer';
import { openChartDialog } from '@/features/charts/ui/ChartDialog';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';

export function ChartElement(props: PlateElementProps<TChartElement>) {
  const editor = useEditorRef();
  const selected = useSelected();
  const focused = useFocused();
  const readOnly = useReadOnly();
  const { t } = useTranslation();

  return (
    <PlateElement {...props} className="py-3">
      <figure
        className={cn(
          'group/chart bg-background m-0 border p-4',
          selected && focused && 'ring-ring ring-2 ring-offset-2'
        )}
      >
        {!readOnly ? (
          <div
            contentEditable={false}
            data-testid="plate-chart-toolbar"
            className="mb-2 flex min-h-8 justify-end gap-1"
            onMouseDown={event => event.stopPropagation()}
            onPointerDown={event => event.stopPropagation()}
          >
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="pointer-events-none size-8 opacity-0 shadow-sm transition-opacity group-focus-within/chart:pointer-events-auto group-focus-within/chart:opacity-100 group-hover/chart:pointer-events-auto group-hover/chart:opacity-100"
              title={t('plateJs.chart.edit')}
              onClick={event => {
                event.stopPropagation();
                openChartDialog(props.element);
              }}
            >
              <PencilIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="pointer-events-none size-8 opacity-0 shadow-sm transition-opacity group-focus-within/chart:pointer-events-auto group-focus-within/chart:opacity-100 group-hover/chart:pointer-events-auto group-hover/chart:opacity-100"
              title={t('plateJs.chart.delete')}
              onClick={event => {
                event.stopPropagation();
                const path = editor.api.findPath(props.element);
                if (path) editor.tf.removeNodes({ at: path });
              }}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        ) : null}
        <div
          contentEditable={false}
          data-testid="plate-chart-interaction-surface"
          onMouseDown={event => event.stopPropagation()}
          onPointerDown={event => event.stopPropagation()}
        >
          <ChartRenderer
            chartType={props.element.chartType}
            points={props.element.points}
            presentation={props.element.presentation}
          />
        </div>
      </figure>
      {props.children}
    </PlateElement>
  );
}

import type { SlateElementProps } from 'platejs';
import { SlateElement } from 'platejs';
import type { TChartElement } from '@/features/charts/types';
import { ChartRenderer } from '@/features/charts/ui/ChartRenderer';

export function ChartElementStatic(props: SlateElementProps<TChartElement>) {
  return (
    <SlateElement {...props} className="py-3">
      <figure className="bg-background m-0 border p-4">
        <ChartRenderer
          chartType={props.element.chartType}
          points={props.element.points}
          presentation={props.element.presentation}
          staticMode
        />
      </figure>
      {props.children}
    </SlateElement>
  );
}

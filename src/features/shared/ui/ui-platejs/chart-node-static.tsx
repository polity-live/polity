import type { SlateElementProps } from 'platejs';
import { SlateElement } from 'platejs/static';
import type { TDataViewElement } from '@/features/charts/types';
import { DataViewRenderer } from '@/features/charts/ui/DataViewRenderer';

export function ChartElementStatic(props: SlateElementProps<TDataViewElement>) {
  return (
    <SlateElement {...props} className="py-3">
      <figure className="bg-background m-0 border p-4">
        <DataViewRenderer element={props.element} />
      </figure>
      {props.children}
    </SlateElement>
  );
}

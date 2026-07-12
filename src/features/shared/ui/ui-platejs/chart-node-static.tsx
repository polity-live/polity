import type { SlateElementProps } from 'platejs/static';
import { SlateElement } from 'platejs/static';
import type { TDataViewElement } from '@/features/charts/types';
import { DataViewRenderer } from '@/features/charts/ui/DataViewRenderer';
import { useAuth } from '@/providers/auth-provider';

export function ChartElementStatic(props: SlateElementProps<TDataViewElement>) {
  const { loading, session } = useAuth();

  return (
    <SlateElement {...props} className="py-3">
      <figure className="bg-background m-0 border p-4">
        {!loading ? (
          <DataViewRenderer element={props.element} accessToken={session?.access_token} />
        ) : null}
      </figure>
      {props.children}
    </SlateElement>
  );
}

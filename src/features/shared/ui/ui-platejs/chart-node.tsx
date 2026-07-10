import type { PlateElementProps } from 'platejs/react';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { PlateElement, useEditorRef, useFocused, useReadOnly, useSelected } from 'platejs/react';
import { useTranslation } from 'react-i18next';
import type { TDataViewElement } from '@/features/charts/types';
import { DataViewRenderer } from '@/features/charts/ui/DataViewRenderer';
import { openDataViewDialog } from '@/features/charts/ui/ChartDialog';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';

export function ChartElement(props: PlateElementProps<TDataViewElement>) {
  const editor = useEditorRef();
  const selected = useSelected();
  const focused = useFocused();
  const readOnly = useReadOnly();
  const { t } = useTranslation();
  const { session } = useAuth();
  return (
    <PlateElement {...props} className="py-3">
      <figure
        className={cn(
          'group/data-view bg-background m-0 border p-4',
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
              className="pointer-events-none size-8 opacity-0 shadow-sm transition-opacity group-focus-within/data-view:pointer-events-auto group-focus-within/data-view:opacity-100 group-hover/data-view:pointer-events-auto group-hover/data-view:opacity-100"
              title={t('plateJs.dataView.edit', 'Edit data view')}
              onClick={event => {
                event.stopPropagation();
                openDataViewDialog(props.element);
              }}
            >
              <PencilIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="pointer-events-none size-8 opacity-0 shadow-sm transition-opacity group-focus-within/data-view:pointer-events-auto group-focus-within/data-view:opacity-100 group-hover/data-view:pointer-events-auto group-hover/data-view:opacity-100"
              title={t('plateJs.dataView.delete', 'Delete data view')}
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
          <DataViewRenderer element={props.element} accessToken={session?.access_token} />
        </div>
      </figure>
      {props.children}
    </PlateElement>
  );
}

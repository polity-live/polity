import * as React from 'react';

import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { TablePlugin, useTableMergeState } from '@platejs/table/react';
import { KEYS } from 'platejs';
import { useEditorPlugin, useEditorSelector } from 'platejs/react';
import { useTranslation } from 'react-i18next';
import { TableToolbarButtonView } from './TableToolbarButtonView';
export function TableToolbarButton(props: DropdownMenuProps) {
  const tableSelected = useEditorSelector(
    editor => editor.api.some({ match: { type: KEYS.table } }),
    []
  );

  const { editor, tf } = useEditorPlugin(TablePlugin);
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const mergeState = useTableMergeState();
  return (
    <TableToolbarButtonView
      props={props}
      tableSelected={tableSelected}
      editor={editor}
      tf={tf}
      t={t}
      open={open}
      setOpen={setOpen}
      mergeState={mergeState}
    />
  );
}

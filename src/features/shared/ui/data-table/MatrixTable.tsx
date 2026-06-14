import type { ComponentProps } from 'react';

import { Checkbox } from '@/features/shared/ui/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';

export {
  TableBody as MatrixTableBody,
  TableCell as MatrixTableCell,
  TableHead as MatrixTableHead,
  TableHeader as MatrixTableHeader,
  TableRow as MatrixTableRow,
};

export function MatrixTable(props: ComponentProps<typeof Table>) {
  return <Table data-slot="matrix-table" {...props} />;
}

export function MatrixCheckbox(props: ComponentProps<typeof Checkbox>) {
  return <Checkbox data-slot="matrix-checkbox" {...props} />;
}

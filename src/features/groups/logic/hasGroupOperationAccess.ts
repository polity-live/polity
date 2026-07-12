interface GroupOperationAccessOptions {
  canViewDatasets?: boolean;
  canViewDocuments: boolean;
  canViewLinks: boolean;
  canViewPayments: boolean;
  canViewTodos: boolean;
}

export function hasGroupOperationAccess({
  canViewDatasets = false,
  canViewDocuments,
  canViewLinks,
  canViewPayments,
  canViewTodos,
}: GroupOperationAccessOptions): boolean {
  return canViewDatasets || canViewDocuments || canViewLinks || canViewPayments || canViewTodos;
}

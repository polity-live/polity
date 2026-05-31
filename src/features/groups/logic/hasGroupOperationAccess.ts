interface GroupOperationAccessOptions {
  canViewDocuments: boolean;
  canViewLinks: boolean;
  canViewPayments: boolean;
  canViewTodos: boolean;
}

export function hasGroupOperationAccess({
  canViewDocuments,
  canViewLinks,
  canViewPayments,
  canViewTodos,
}: GroupOperationAccessOptions): boolean {
  return canViewDocuments || canViewLinks || canViewPayments || canViewTodos;
}

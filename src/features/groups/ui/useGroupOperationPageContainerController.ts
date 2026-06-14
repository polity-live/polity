import { hasGroupOperationAccess } from '@/features/groups/logic/hasGroupOperationAccess';
import { usePermissions } from '@/zero/rbac';
interface GroupOperationPageContainerProps {
  groupId: string;
  hash: string;
}

export function useGroupOperationPageContainerController({
  groupId,
  hash,
}: GroupOperationPageContainerProps) {
  const { canManage, canView, isLoading, isMember } = usePermissions({ groupId });

  const canViewDocuments = canView('groupDocuments');

  const canViewLinks = canView('groupLinks');

  const canViewPayments = canView('groupPayments');

  const canViewTodos = canView('groupTodos');

  const canAccessOperation = hasGroupOperationAccess({
    canViewDocuments,
    canViewLinks,
    canViewPayments,
    canViewTodos,
  });

  return {
    groupId,
    hash,
    canManage,
    canView,
    isLoading,
    isMember,
    canViewDocuments,
    canViewLinks,
    canViewPayments,
    canViewTodos,
    canAccessOperation,
  };
}

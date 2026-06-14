'use client';

import { ReactNode } from 'react';
import { usePermissions } from '@/zero/rbac/usePermissions';
import { ActionType, ResourceType, PermissionContext } from '@/zero/rbac/types';

interface PermissionGuardProps {
  children: ReactNode;
  action: ActionType;
  resource: ResourceType;
  context: PermissionContext;
  fallback?: ReactNode;
  loadingComponent?: ReactNode;
}
export function usePermissionGuardController({
  children,
  action,
  resource,
  context,
  fallback,
  loadingComponent,
}: PermissionGuardProps) {
  const { can, isLoading } = usePermissions(context);

  return {
    children,
    action,
    resource,
    context,
    fallback,
    loadingComponent,
    can,
    isLoading,
  };
}

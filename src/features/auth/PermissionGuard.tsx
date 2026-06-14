'use client';

import { ReactNode } from 'react';
import { ActionType, ResourceType, PermissionContext } from '@/zero/rbac/types';
import { AccessDenied } from '@/features/auth/ui/AccessDenied.tsx';

interface PermissionGuardProps {
  children: ReactNode;
  action: ActionType;
  resource: ResourceType;
  context: PermissionContext;
  fallback?: ReactNode;
  loadingComponent?: ReactNode;
}
import { usePermissionGuardController } from './usePermissionGuardController';
import { PermissionGuardView } from './PermissionGuardView';
export function PermissionGuard({
  children,
  action,
  resource,
  context,
  fallback = <AccessDenied />,
  loadingComponent,
}: PermissionGuardProps) {
  const viewProps = usePermissionGuardController({
    children,
    action,
    resource,
    context,
    fallback,
    loadingComponent,
  });

  return <PermissionGuardView {...viewProps} />;
}

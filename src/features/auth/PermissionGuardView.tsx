'use client';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
export interface PermissionGuardViewProps {
  children: any;
  action: any;
  resource: any;
  context: any;
  fallback: any;
  loadingComponent: any;
  can: any;
  isLoading: any;
}

export function PermissionGuardView({
  children,
  action,
  resource,
  fallback,
  loadingComponent,
  can,
  isLoading,
}: PermissionGuardViewProps) {
  if (isLoading) {
    return loadingComponent || <SectionSkeleton className="min-h-[200px] py-4" rows={2} />;
  }

  if (!can(action, resource)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

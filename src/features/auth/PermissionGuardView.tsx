'use client';
import { Loader2 } from 'lucide-react';
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
    return (
      loadingComponent || (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      )
    );
  }

  if (!can(action, resource)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

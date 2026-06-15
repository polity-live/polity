import { getRoleToneClasses } from '@/features/shared/theme';
import type { ComponentProps, ReactNode } from 'react';

import { RoleBadge } from '@/features/shared/ui/status';
import { cn } from '@/features/shared/utils/utils';

interface RoleTagProps extends Omit<ComponentProps<typeof RoleBadge>, 'children'> {
  roleId?: string | null;
  roleName?: string | null;
  fallbackKey?: string;
  children?: ReactNode;
}

export function RoleTag({
  roleId,
  roleName,
  fallbackKey = 'role',
  className,
  children,
  ...props
}: RoleTagProps) {
  const roleKey = roleId ?? roleName ?? fallbackKey;
  const roleTone = getRoleToneClasses();

  return (
    <RoleBadge className={cn(roleTone.badge, className)} data-role-key={roleKey} {...props}>
      {children ?? roleName ?? 'Role'}
    </RoleBadge>
  );
}

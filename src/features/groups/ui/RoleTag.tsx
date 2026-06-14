import { featureThemeClassName } from '@/features/shared/theme';
import type { ComponentProps, ReactNode } from 'react';

import { RoleBadge } from '@/features/shared/ui/status';
import { BADGE_GRADIENTS } from '@/features/timeline/logic/gradient-assignment';
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

  return (
    <RoleBadge
      className={cn(
        featureThemeClassName('groupRoleTagContrastBorder'),
        getRoleGradientClassName(roleKey),
        className
      )}
      {...props}
    >
      {children ?? roleName ?? 'Role'}
    </RoleBadge>
  );
}

function getRoleGradientClassName(roleKey: string) {
  let hash = 0;

  for (let index = 0; index < roleKey.length; index++) {
    const charCode = roleKey.charCodeAt(index);
    hash = (hash << 5) - hash + charCode;
    hash &= hash;
  }

  return BADGE_GRADIENTS[Math.abs(hash) % BADGE_GRADIENTS.length];
}

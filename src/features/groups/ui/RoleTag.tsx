import { Badge, type BadgeProps } from '@/features/shared/ui/ui/badge';
import { BADGE_GRADIENTS } from '@/features/timeline/logic/gradient-assignment';
import { cn } from '@/features/shared/utils/utils';

interface RoleTagProps extends BadgeProps {
  roleId?: string | null;
  roleName?: string | null;
  fallbackKey?: string;
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
    <Badge
      className={cn(
        'border-0 text-white shadow-sm shadow-black/10 dark:text-white',
        getRoleGradientClassName(roleKey),
        className
      )}
      {...props}
    >
      {children ?? roleName ?? 'Role'}
    </Badge>
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

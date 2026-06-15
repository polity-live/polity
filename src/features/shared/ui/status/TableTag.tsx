import { Badge, type BadgeProps } from '@/features/shared/ui/ui/badge';
import { type SearchCardGradientEntity } from '@/features/shared/utils/search-card-gradients';
import { getEntityToneClasses } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils.ts';

export function getTableTagSurfaceClassName(entityType: SearchCardGradientEntity): string {
  return cn(getEntityToneClasses(entityType).tableTag, 'shadow-sm', '[&>svg]:opacity-70');
}

interface TableTagProps extends BadgeProps {
  entityType: SearchCardGradientEntity;
}

export function TableTag({ entityType, className, variant = 'outline', ...props }: TableTagProps) {
  return (
    <Badge
      variant={variant}
      className={cn(getTableTagSurfaceClassName(entityType), className)}
      {...props}
    />
  );
}

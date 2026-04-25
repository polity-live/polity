import { Badge, type BadgeProps } from '@/features/shared/ui/ui/badge';
import {
  SEARCH_CARD_GRADIENTS,
  type SearchCardGradientEntity,
} from '@/features/shared/utils/search-card-gradients';
import { cn } from '@/features/shared/utils/utils.ts';

const tableTagToneClassNames: Record<SearchCardGradientEntity, string> = {
  group:
    'border-emerald-200/80 text-emerald-950 shadow-sm shadow-emerald-200/40 dark:border-emerald-800/70 dark:text-emerald-50',
  event:
    'border-amber-200/80 text-amber-950 shadow-sm shadow-amber-200/40 dark:border-amber-800/70 dark:text-amber-50',
  amendment:
    'border-violet-200/80 text-violet-950 shadow-sm shadow-violet-200/40 dark:border-violet-800/70 dark:text-violet-50',
  blog:
    'border-blue-200/80 text-indigo-950 shadow-sm shadow-blue-200/40 dark:border-blue-900/70 dark:text-indigo-50',
  user:
    'border-blue-200/80 text-blue-950 shadow-sm shadow-blue-200/40 dark:border-blue-800/70 dark:text-blue-50',
};

export function getTableTagSurfaceClassName(entityType: SearchCardGradientEntity): string {
  return cn(
    SEARCH_CARD_GRADIENTS[entityType],
    tableTagToneClassNames[entityType],
    '[&>svg]:opacity-70'
  );
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
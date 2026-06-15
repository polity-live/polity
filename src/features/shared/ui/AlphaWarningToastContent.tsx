import { Badge } from '@/features/shared/ui/ui/badge.tsx';
import { getSemanticToneClasses } from '@/features/shared/theme';

interface AlphaWarningToastContentProps {
  title: string;
  version: string;
}

export function AlphaWarningToastContent({ title, version }: AlphaWarningToastContentProps) {
  return (
    <span className="flex items-center gap-2">
      <span>{title}</span>
      <Badge className={getSemanticToneClasses('warning').badge}>{version}</Badge>
    </span>
  );
}

import { Badge } from '@/features/shared/ui/ui/badge.tsx';

interface AlphaWarningToastContentProps {
  title: string;
  version: string;
}

export function AlphaWarningToastContent({ title, version }: AlphaWarningToastContentProps) {
  return (
    <span className="flex items-center gap-2">
      <span>{title}</span>
      <Badge className="border-0 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 font-bold text-slate-950 shadow-sm">
        {version}
      </Badge>
    </span>
  );
}

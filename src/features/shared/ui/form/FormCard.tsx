import type { ReactNode } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { cn } from '@/features/shared/utils/utils';

interface FormCardProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  pageClassName?: string;
}

export function FormCard({
  title,
  description,
  icon,
  children,
  className,
  contentClassName,
  pageClassName,
}: FormCardProps) {
  return (
    <div
      className={cn(
        'bg-background flex min-h-screen items-center justify-center p-4',
        pageClassName
      )}
    >
      <Card className={cn('w-full max-w-md', className)}>
        <CardHeader className="text-center">
          {icon ? <div className="mb-4 flex justify-center">{icon}</div> : null}
          <CardTitle className="text-2xl font-bold">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className={contentClassName}>{children}</CardContent>
      </Card>
    </div>
  );
}

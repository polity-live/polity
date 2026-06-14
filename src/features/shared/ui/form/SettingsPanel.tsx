import type { ReactNode } from 'react';

import {
  Panel,
  PanelContent,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from '@/features/shared/ui/layout';
import { cn } from '@/features/shared/utils/utils';

interface SettingsPanelProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  variant?: 'default' | 'danger';
  className?: string;
  contentClassName?: string;
}

export function SettingsPanel({
  title,
  description,
  icon,
  action,
  children,
  variant = 'default',
  className,
  contentClassName,
}: SettingsPanelProps) {
  return (
    <Panel
      className={cn(
        variant === 'danger' &&
          'border-destructive ring-destructive/20 dark:ring-destructive/40 ring-[3px]',
        className
      )}
    >
      <PanelHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <PanelTitle className="flex items-center gap-2">
              {icon}
              {title}
            </PanelTitle>
            {description ? <PanelDescription>{description}</PanelDescription> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </PanelHeader>
      <PanelContent className={contentClassName}>{children}</PanelContent>
    </Panel>
  );
}

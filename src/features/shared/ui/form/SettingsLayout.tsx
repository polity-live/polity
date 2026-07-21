import type { ReactNode } from 'react';

import { PageHeader } from '@/features/shared/ui/layout';
import { Tabs, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { cn } from '@/features/shared/utils/utils';

export interface SettingsTab<TValue extends string = string> {
  value: TValue;
  label: ReactNode;
  disabled?: boolean;
}

interface SettingsPageProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  size?: 'default' | 'wide';
  headingMode?: 'visible' | 'sr-only' | 'none';
}

export function SettingsPage({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  size = 'default',
  headingMode = 'visible',
}: SettingsPageProps) {
  return (
    <div
      data-slot="settings-page"
      className={cn(
        '[&_[data-slot=card]]:border-border/60 mx-auto w-full pb-6 [&_[data-slot=card-content]]:p-4 [&_[data-slot=card-content]]:pt-0 sm:[&_[data-slot=card-content]]:p-5 sm:[&_[data-slot=card-content]]:pt-0 [&_[data-slot=card-header]]:p-4 sm:[&_[data-slot=card-header]]:p-5 [&_[data-slot=card]]:shadow-none',
        (headingMode === 'visible' || actions) && 'space-y-6',
        size === 'wide' ? 'max-w-7xl' : 'max-w-5xl',
        className
      )}
    >
      {headingMode === 'visible' ? (
        <PageHeader title={title} description={description} actions={actions} />
      ) : headingMode === 'sr-only' ? (
        <header className="sr-only">
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </header>
      ) : null}
      {headingMode !== 'visible' && actions ? (
        <div className="flex justify-end">{actions}</div>
      ) : null}
      <div className={cn('min-w-0', contentClassName)}>{children}</div>
    </div>
  );
}

interface SettingsTabsProps<TValue extends string> {
  tabs: readonly SettingsTab<TValue>[];
  value: TValue;
  onValueChange?: (value: TValue) => void;
  children: ReactNode;
  className?: string;
  listClassName?: string;
  action?: ReactNode;
}

export function SettingsTabs<TValue extends string>({
  tabs,
  value,
  onValueChange,
  children,
  className,
  listClassName,
  action,
}: SettingsTabsProps<TValue>) {
  return (
    <Tabs
      value={value}
      onValueChange={nextValue => onValueChange?.(nextValue as TValue)}
      className={cn('min-w-0 space-y-6', className)}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <TabsList
            className={cn(
              'scrollbar-hide border-border/60 bg-muted/35 h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg p-1 shadow-none',
              listClassName
            )}
          >
            {tabs.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                disabled={tab.disabled}
                className="min-h-9 shrink-0 rounded-md px-3 data-[state=active]:shadow-none"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </Tabs>
  );
}

interface SettingsActionBarProps {
  children: ReactNode;
  className?: string;
}

interface FloatingActionBarProps extends SettingsActionBarProps {
  dataSlot?: string;
}

export function FloatingActionBar({
  children,
  className,
  dataSlot = 'floating-action-bar',
}: FloatingActionBarProps) {
  return (
    <div
      data-slot={dataSlot}
      className={cn(
        'bg-background/95 supports-[backdrop-filter]:bg-background/80 border-border/70 sticky bottom-3 z-20 rounded-xl border p-3 shadow-lg backdrop-blur',
        className
      )}
    >
      {children}
    </div>
  );
}

export function SettingsActionBar({ children, className }: SettingsActionBarProps) {
  return (
    <FloatingActionBar dataSlot="settings-action-bar" className={className}>
      {children}
    </FloatingActionBar>
  );
}

export function ManagementToolbar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="management-toolbar"
      className={cn(
        'border-border/60 bg-muted/20 flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center [&>*]:min-w-0',
        className
      )}
      {...props}
    />
  );
}

interface ManagementSectionProps extends Omit<React.ComponentProps<'section'>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  contentClassName?: string;
}

export function ManagementSection({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  ...props
}: ManagementSectionProps) {
  return (
    <section data-slot="management-section" className={cn('space-y-3', className)} {...props}>
      {title || description || action ? (
        <div
          data-slot="management-section-header"
          className="flex flex-col gap-3 px-3 sm:flex-row sm:items-start sm:justify-between sm:px-4"
        >
          <div className="space-y-1.5">
            {title ? <h2 className="text-base leading-none font-semibold">{title}</h2> : null}
            {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div data-slot="management-section-content" className={cn('min-w-0', contentClassName)}>
        {children}
      </div>
    </section>
  );
}

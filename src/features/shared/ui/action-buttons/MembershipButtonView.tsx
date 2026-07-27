import type { ReactNode } from 'react';

import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  ResponsiveActionLabel,
  compactActionButtonClassName,
} from '@/features/shared/ui/layout/ActionBar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { Check, Clock, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';

interface MembershipButtonViewProps {
  isMember: boolean;
  hasRequested: boolean;
  isInvited: boolean;
  isLoading: boolean;
  className?: string;
  compactOnMobile?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  conflictDetails?: ReactNode;
  labels: {
    request: string;
    leave: string;
    pending: string;
    accept: string;
  };
  compactLabels: {
    request: string;
    leave: string;
    pending: string;
    accept: string;
  };
  loadingLabel: string;
  buttonConfig: {
    label: string;
    compactLabel: string;
    icon: LucideIcon;
    variant: 'default' | 'outline';
    onClick: () => void;
  };
  showDisabledReason: boolean;
  disabledAriaLabel: string;
  onDisabledReasonOpenChange: (open: boolean) => void;
  onDisabledPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onDisabledPointerUp: () => void;
  onDisabledPointerCancel: () => void;
  onDisabledPointerLeave: () => void;
  onDisabledBlur: () => void;
}

export function MembershipButtonView({
  isMember,
  hasRequested,
  isInvited,
  isLoading,
  className,
  compactOnMobile = false,
  disabled,
  disabledReason,
  conflictDetails,
  labels,
  compactLabels,
  loadingLabel,
  buttonConfig,
  showDisabledReason,
  disabledAriaLabel,
  onDisabledReasonOpenChange,
  onDisabledPointerDown,
  onDisabledPointerUp,
  onDisabledPointerCancel,
  onDisabledPointerLeave,
  onDisabledBlur,
}: MembershipButtonViewProps) {
  const showDisabledReasonState = Boolean(disabled && (!isLoading || disabledReason));
  const resolvedClassName = cn(compactOnMobile && compactActionButtonClassName, className);
  const renderLabel = (full: string, compact: string) => (
    <ResponsiveActionLabel full={full} compact={compactOnMobile ? compact : undefined} />
  );

  if (showDisabledReasonState) {
    const Icon = buttonConfig.icon;
    const disabledButton = (
      <Button
        data-tutorial-anchor="request-membership"
        disabled
        variant={buttonConfig.variant}
        className={resolvedClassName}
        aria-label={buttonConfig.label}
      >
        <Icon className={cn('h-4 w-4', compactOnMobile ? 'mr-0 sm:mr-2' : 'mr-2')} />
        {renderLabel(buttonConfig.label, buttonConfig.compactLabel)}
        {disabledReason ? (
          <span
            aria-hidden="true"
            className="inline-flex size-4 items-center justify-center rounded-sm border border-current/40 text-[0.65rem] leading-none font-semibold"
          >
            ?
          </span>
        ) : null}
      </Button>
    );

    const content = disabledReason ? (
      <Tooltip open={showDisabledReason} onOpenChange={onDisabledReasonOpenChange}>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex cursor-help"
            aria-label={disabledAriaLabel}
            onPointerDown={onDisabledPointerDown}
            onPointerUp={onDisabledPointerUp}
            onPointerCancel={onDisabledPointerCancel}
            onPointerLeave={onDisabledPointerLeave}
            onBlur={onDisabledBlur}
          >
            {disabledButton}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {disabledReason}
        </TooltipContent>
      </Tooltip>
    ) : (
      disabledButton
    );

    return (
      <div className="flex items-center gap-2">
        {content}
        {conflictDetails}
      </div>
    );
  }

  if (hasRequested) {
    return (
      <Button
        data-tutorial-anchor="request-membership"
        onClick={buttonConfig.onClick}
        loading={isLoading}
        loadingLabel={loadingLabel}
        variant="outline"
        className={resolvedClassName}
        aria-label={labels.pending}
      >
        <Clock className={cn('h-4 w-4', compactOnMobile ? 'mr-0 sm:mr-2' : 'mr-2')} />
        {renderLabel(labels.pending, compactLabels.pending)}
      </Button>
    );
  }

  if (isMember) {
    return (
      <Button
        data-tutorial-anchor="request-membership"
        onClick={buttonConfig.onClick}
        loading={isLoading}
        loadingLabel={loadingLabel}
        variant="outline"
        className={resolvedClassName}
        aria-label={labels.leave}
      >
        <UserMinus className={cn('h-4 w-4', compactOnMobile ? 'mr-0 sm:mr-2' : 'mr-2')} />
        {renderLabel(labels.leave, compactLabels.leave)}
      </Button>
    );
  }

  if (isInvited) {
    return (
      <Button
        data-tutorial-anchor="request-membership"
        onClick={buttonConfig.onClick}
        loading={isLoading}
        loadingLabel={loadingLabel}
        variant="default"
        className={resolvedClassName}
        aria-label={labels.accept}
      >
        <Check className={cn('h-4 w-4', compactOnMobile ? 'mr-0 sm:mr-2' : 'mr-2')} />
        {renderLabel(labels.accept, compactLabels.accept)}
      </Button>
    );
  }

  return (
    <Button
      data-tutorial-anchor="request-membership"
      onClick={buttonConfig.onClick}
      loading={isLoading}
      loadingLabel={loadingLabel}
      className={resolvedClassName}
      aria-label={labels.request}
    >
      <UserPlus className={cn('h-4 w-4', compactOnMobile ? 'mr-0 sm:mr-2' : 'mr-2')} />
      {renderLabel(labels.request, compactLabels.request)}
    </Button>
  );
}

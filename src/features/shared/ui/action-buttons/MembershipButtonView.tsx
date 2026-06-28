import type { ReactNode } from 'react';

import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { Check, Clock, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';

interface MembershipButtonViewProps {
  isMember: boolean;
  hasRequested: boolean;
  isInvited: boolean;
  isLoading: boolean;
  className?: string;
  disabled?: boolean;
  disabledReason?: string;
  conflictDetails?: ReactNode;
  labels: {
    request: string;
    leave: string;
    pending: string;
    accept: string;
  };
  loadingLabel: string;
  buttonConfig: {
    label: string;
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
  disabled,
  disabledReason,
  conflictDetails,
  labels,
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

  if (showDisabledReasonState) {
    const Icon = buttonConfig.icon;
    const disabledButton = (
      <Button disabled variant={buttonConfig.variant} className={className}>
        <Icon className="mr-2 h-4 w-4" />
        {buttonConfig.label}
        {disabledReason ? (
          <span
            aria-hidden="true"
            className="inline-flex size-4 items-center justify-center rounded-full border border-current/40 text-[0.65rem] leading-none font-semibold"
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
        onClick={buttonConfig.onClick}
        loading={isLoading}
        loadingLabel={loadingLabel}
        variant="outline"
        className={className}
      >
        <Clock className="mr-2 h-4 w-4" />
        {labels.pending}
      </Button>
    );
  }

  if (isMember) {
    return (
      <Button
        onClick={buttonConfig.onClick}
        loading={isLoading}
        loadingLabel={loadingLabel}
        variant="outline"
        className={className}
      >
        <UserMinus className="mr-2 h-4 w-4" />
        {labels.leave}
      </Button>
    );
  }

  if (isInvited) {
    return (
      <Button
        onClick={buttonConfig.onClick}
        loading={isLoading}
        loadingLabel={loadingLabel}
        variant="default"
        className={className}
      >
        <Check className="mr-2 h-4 w-4" />
        {labels.accept}
      </Button>
    );
  }

  return (
    <Button
      onClick={buttonConfig.onClick}
      loading={isLoading}
      loadingLabel={loadingLabel}
      className={className}
    >
      <UserPlus className="mr-2 h-4 w-4" />
      {labels.request}
    </Button>
  );
}

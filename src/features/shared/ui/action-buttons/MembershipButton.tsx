'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { UserPlus, UserMinus, Clock, Check } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import type { GroupConflictResponse } from '@/features/groups/logic/groupConflict';
import { GroupConflictDialog } from '@/features/groups/ui/GroupConflictPanel';

export type MembershipStatus = 'invited' | 'requested' | 'member' | 'admin' | 'collaborator';
export type MembershipAction = 'join' | 'participate' | 'collaborate';

interface MembershipButtonProps {
  /**
   * The type of action - determines button labels
   * join: For groups (request to join, leave group)
   * participate: For events (request to participate, leave event)
   * collaborate: For amendments/blogs (request collaboration, leave collaboration)
   */
  actionType: MembershipAction;

  /** Current membership status */
  status: MembershipStatus | null;

  /** Whether user is currently a member/participant/collaborator */
  isMember: boolean;

  /** Whether user has requested to join/participate/collaborate */
  hasRequested: boolean;

  /** Whether user has been invited */
  isInvited: boolean;

  /** Callback when requesting to join/participate/collaborate */
  onRequest: () => void;

  /** Callback when leaving */
  onLeave: () => void;

  /** Callback when accepting invitation */
  onAcceptInvitation: () => void;

  /** Loading state */
  isLoading: boolean;

  /** Optional className */
  className?: string;

  /** Whether the button is disabled */
  disabled?: boolean;

  /** Reason shown in tooltip when disabled */
  disabledReason?: string;

  /** Optional structured conflict details for disabled actions */
  conflictResponse?: GroupConflictResponse | null;
}

/**
 * Generic membership button for different entity types.
 * Handles join/participate/collaborate actions with different labels.
 */
export function MembershipButton({
  actionType,
  isMember,
  hasRequested,
  isInvited,
  onRequest,
  onLeave,
  onAcceptInvitation,
  isLoading,
  className,
  disabled,
  disabledReason,
  conflictResponse,
}: MembershipButtonProps) {
  const { t } = useTranslation();
  const [showDisabledReason, setShowDisabledReason] = useState(false);
  const longPressTimeoutRef = useRef<number | null>(null);

  // Get appropriate labels based on action type
  const getLabels = () => {
    switch (actionType) {
      case 'join':
        return {
          request: t('components.actionBar.requestToJoin'),
          leave: t('components.actionBar.leaveGroup'),
          pending: t('components.actionBar.requestPending'),
          accept: t('components.actionBar.acceptInvitation'),
        };
      case 'participate':
        return {
          request: 'Request to Participate',
          leave: 'Leave Event',
          pending: 'Request Pending',
          accept: 'Accept Invitation',
        };
      case 'collaborate':
        return {
          request: 'Request Collaboration',
          leave: 'Leave Collaboration',
          pending: 'Request Pending',
          accept: 'Accept Invitation',
        };
    }
  };

  const labels = getLabels();

  const buttonConfig = isInvited
    ? {
        label: labels.accept,
        icon: Check,
        variant: 'default' as const,
        onClick: onAcceptInvitation,
      }
    : hasRequested
      ? {
          label: labels.pending,
          icon: Clock,
          variant: 'outline' as const,
          onClick: onLeave,
        }
      : isMember
        ? {
            label: labels.leave,
            icon: UserMinus,
            variant: 'outline' as const,
            onClick: onLeave,
          }
        : {
            label: labels.request,
            icon: UserPlus,
            variant: 'default' as const,
            onClick: onRequest,
          };

  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current !== null) {
        window.clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  const clearLongPressTimeout = () => {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  if (disabled) {
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
      <Tooltip open={showDisabledReason} onOpenChange={setShowDisabledReason}>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex cursor-help"
            aria-label={`${buttonConfig.label}: ${disabledReason}`}
            onPointerDown={event => {
              if (event.pointerType !== 'touch') {
                return;
              }

              clearLongPressTimeout();
              longPressTimeoutRef.current = window.setTimeout(() => {
                setShowDisabledReason(true);
              }, 350);
            }}
            onPointerUp={() => {
              clearLongPressTimeout();
              setShowDisabledReason(false);
            }}
            onPointerCancel={() => {
              clearLongPressTimeout();
              setShowDisabledReason(false);
            }}
            onPointerLeave={() => {
              clearLongPressTimeout();
            }}
            onBlur={() => setShowDisabledReason(false)}
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
        <GroupConflictDialog
          response={conflictResponse}
          triggerLabel="Warum?"
          triggerVariant="ghost"
          title="Warum ist diese Aktion blockiert?"
        />
      </div>
    );
  }

  if (hasRequested) {
    return (
      <Button
        onClick={buttonConfig.onClick}
        disabled={isLoading}
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
        disabled={isLoading}
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
        disabled={isLoading}
        variant="default"
        className={className}
      >
        <Check className="mr-2 h-4 w-4" />
        {labels.accept}
      </Button>
    );
  }

  return (
    <Button onClick={buttonConfig.onClick} disabled={isLoading} className={className}>
      <UserPlus className="mr-2 h-4 w-4" />
      {labels.request}
    </Button>
  );
}

import type React from 'react';

import { useEffect, useRef, useState } from 'react';
import { Check, Clock, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { MembershipAction } from '@/features/shared/ui/action-buttons/MembershipButton';

export function useMembershipButtonController(args: {
  actionType: MembershipAction;
  isMember: boolean;
  hasRequested: boolean;
  isInvited: boolean;
  onRequest: () => void;
  onLeave: () => void;
  onAcceptInvitation: () => void;
  disabledReason?: string;
}) {
  const { t } = useTranslation();
  const [showDisabledReason, setShowDisabledReason] = useState(false);
  const longPressTimeoutRef = useRef<number | null>(null);

  const labels = (() => {
    switch (args.actionType) {
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
  })();

  const buttonConfig: {
    label: string;
    icon: LucideIcon;
    variant: 'default' | 'outline';
    onClick: () => void;
  } = args.isInvited
    ? {
        label: labels.accept,
        icon: Check,
        variant: 'default',
        onClick: args.onAcceptInvitation,
      }
    : args.hasRequested
      ? {
          label: labels.pending,
          icon: Clock,
          variant: 'outline',
          onClick: args.onLeave,
        }
      : args.isMember
        ? {
            label: labels.leave,
            icon: UserMinus,
            variant: 'outline',
            onClick: args.onLeave,
          }
        : {
            label: labels.request,
            icon: UserPlus,
            variant: 'default',
            onClick: args.onRequest,
          };

  const clearLongPressTimeout = () => {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearLongPressTimeout();
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch') {
      return;
    }

    clearLongPressTimeout();
    longPressTimeoutRef.current = window.setTimeout(() => {
      setShowDisabledReason(true);
    }, 350);
  };

  const handlePointerUp = () => {
    clearLongPressTimeout();
    setShowDisabledReason(false);
  };

  return {
    labels,
    buttonConfig,
    showDisabledReason,
    disabledAriaLabel: args.disabledReason
      ? `${buttonConfig.label}: ${args.disabledReason}`
      : buttonConfig.label,
    onDisabledReasonOpenChange: setShowDisabledReason,
    onDisabledPointerDown: handlePointerDown,
    onDisabledPointerUp: handlePointerUp,
    onDisabledPointerCancel: handlePointerUp,
    onDisabledPointerLeave: clearLongPressTimeout,
    onDisabledBlur: () => setShowDisabledReason(false),
  };
}

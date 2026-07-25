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
  loadingLabel?: string;
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
          request: t('components.actionBar.requestToParticipate'),
          leave: t('components.actionBar.leaveEvent'),
          pending: t('components.actionBar.requestPending'),
          accept: t('components.actionBar.acceptInvitation'),
        };
      case 'collaborate':
        return {
          request: t('components.actionBar.requestCollaboration'),
          leave: t('components.actionBar.leaveCollaboration'),
          pending: t('components.actionBar.requestPending'),
          accept: t('components.actionBar.acceptInvitation'),
        };
    }
  })();
  const compactLabels = {
    request:
      args.actionType === 'join'
        ? t('components.actionBar.compact.requestToJoin')
        : args.actionType === 'participate'
          ? t('components.actionBar.compact.participate')
          : t('components.actionBar.compact.collaborate'),
    leave: t('components.actionBar.compact.leave'),
    pending: t('components.actionBar.compact.pending'),
    accept: t('components.actionBar.compact.accept'),
  };

  const loadingLabel =
    args.loadingLabel ??
    (() => {
      switch (args.actionType) {
        case 'join':
          return t('common.checks.membership');
        case 'participate':
          return t('common.checks.participation');
        case 'collaborate':
          return t('common.checks.collaboration');
      }
    })();

  const buttonConfig: {
    label: string;
    compactLabel: string;
    icon: LucideIcon;
    variant: 'default' | 'outline';
    onClick: () => void;
  } = args.isInvited
    ? {
        label: labels.accept,
        compactLabel: compactLabels.accept,
        icon: Check,
        variant: 'default',
        onClick: args.onAcceptInvitation,
      }
    : args.hasRequested
      ? {
          label: labels.pending,
          compactLabel: compactLabels.pending,
          icon: Clock,
          variant: 'outline',
          onClick: args.onLeave,
        }
      : args.isMember
        ? {
            label: labels.leave,
            compactLabel: compactLabels.leave,
            icon: UserMinus,
            variant: 'outline',
            onClick: args.onLeave,
          }
        : {
            label: labels.request,
            compactLabel: compactLabels.request,
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
    compactLabels,
    loadingLabel,
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

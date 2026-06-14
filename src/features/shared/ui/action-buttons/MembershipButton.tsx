'use client';

import type { ReactNode } from 'react';

import { useMembershipButtonController } from '@/features/shared/hooks/useMembershipButtonController';

import { MembershipButtonView } from './MembershipButtonView';

export type MembershipStatus = 'invited' | 'requested' | 'member' | 'admin' | 'collaborator';
export type MembershipAction = 'join' | 'participate' | 'collaborate';

interface MembershipButtonProps {
  actionType: MembershipAction;
  status: MembershipStatus | null;
  isMember: boolean;
  hasRequested: boolean;
  isInvited: boolean;
  onRequest: () => void;
  onLeave: () => void;
  onAcceptInvitation: () => void;
  isLoading: boolean;
  className?: string;
  disabled?: boolean;
  disabledReason?: string;
  conflictResponse?: unknown;
  conflictDetails?: ReactNode;
}

export function MembershipButton({
  actionType,
  status,
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
  conflictDetails,
}: MembershipButtonProps) {
  void status;
  void conflictResponse;

  const controller = useMembershipButtonController({
    actionType,
    isMember,
    hasRequested,
    isInvited,
    onRequest,
    onLeave,
    onAcceptInvitation,
    disabledReason,
  });

  return (
    <MembershipButtonView
      isMember={isMember}
      hasRequested={hasRequested}
      isInvited={isInvited}
      isLoading={isLoading}
      className={className}
      disabled={disabled}
      disabledReason={disabledReason}
      conflictDetails={conflictDetails}
      {...controller}
    />
  );
}

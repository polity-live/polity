'use client';

import { useState } from 'react';
import { useGroupActiveMembers } from '@/zero/groups/useGroupState';
import { toast } from '@/features/shared/ui/ui/sonner';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface RoleWithHistory {
  id: string;
  title?: string | null;
  assignment_mode?: string | null;
  holder_history?: readonly {
    end_date?: number | string | null;
    user?: {
      id: string;
      first_name?: string | null;
      handle?: string | null;
      avatar?: string | null;
    };
  }[];
}

interface AssignHolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleWithHistory;
  groupId: string;
  onAssign: (userId: string, reason: 'elected' | 'appointed') => void;
}
export function useAssignHolderDialogController({
  open,
  onOpenChange,
  role,
  groupId,
  onAssign,
}: AssignHolderDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reason, setReason] = useState<'elected' | 'appointed'>('appointed');

  const { members } = useGroupActiveMembers(groupId);
  const currentHolder = role?.holder_history?.find(h => !h.end_date)?.user;
  const isElectedRole = role.assignment_mode === 'elected';

  // Filter members based on search query
  const filteredMembers = members.filter(membership => {
    const user = membership.user;
    if (!user?.id) return false;
    const query = searchQuery.toLowerCase();
    return (
      user.first_name?.toLowerCase().includes(query) ||
      user.handle?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  const selectedMember = members.find(m => m.user?.id === selectedUserId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isElectedRole) {
      toast.error(
        translateText(
          'generated.inline.0644_elected_roles_must_be_filled_through_an_elect_e1448a79'
        )
      );
      return;
    }

    if (!selectedUserId) {
      toast.error(translateText('generated.inline.0645_please_select_a_member_d3309803'));
      return;
    }

    onAssign(selectedUserId, reason);
    onOpenChange(false);
    setSelectedUserId(null);
    setSearchQuery('');
    setReason('appointed');
  };
  return {
    open,
    onOpenChange,
    role,
    groupId,
    onAssign,
    searchQuery,
    setSearchQuery,
    popoverOpen,
    setPopoverOpen,
    selectedUserId,
    setSelectedUserId,
    reason,
    setReason,
    members,
    currentHolder,
    isElectedRole,
    filteredMembers,
    selectedMember,
    handleSubmit,
  };
}

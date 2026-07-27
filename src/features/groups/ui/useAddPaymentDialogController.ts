'use client';

import { useEffect, useState } from 'react';
import { useUserState } from '@/zero/users/useUserState';
import { useAllGroups } from '@/zero/groups/useGroupState';
import { toast } from '@/features/shared/ui/ui/sonner';
import { usePreferenceState } from '@/zero/preferences/usePreferenceState';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    label: string;
    type: string;
    amount: number;
    currency: string;
    direction: 'income' | 'expense';
    payerUserId?: string;
    payerGroupId?: string;
    receiverUserId?: string;
    receiverGroupId?: string;
  }) => void;
  direction: 'income' | 'expense';
  groupId: string;
}
export function useAddPaymentDialogController({
  open,
  onOpenChange,
  onSubmit,
  direction,
  groupId,
}: AddPaymentDialogProps) {
  const { displayCurrency } = usePreferenceState();
  const [label, setLabel] = useState('');
  const [type, setType] = useState('donation');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(displayCurrency);
  const [searchQuery, setSearchQuery] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [entityType, setEntityType] = useState<'user' | 'group'>('user');
  const [selectedEntity, setSelectedEntity] = useState<{
    id: string;
    name: string;
    type: 'user' | 'group';
  } | null>(null);

  const { allUsers } = useUserState({ includeAllUsers: true });
  const { groups: allGroups } = useAllGroups();

  useEffect(() => {
    if (open) setCurrency(displayCurrency);
  }, [displayCurrency, open]);

  const getUserDisplayName = (user: {
    first_name?: string | null;
    last_name?: string | null;
    handle?: string | null;
  }): string =>
    [user.first_name, user.last_name].filter(Boolean).join(' ') || user.handle || 'Unnamed User';

  // Filter entities based on search query and selected entity type
  const filteredUsers =
    entityType === 'user'
      ? allUsers?.filter(user => {
          if (!user?.id) return false;
          const query = searchQuery.toLowerCase();
          const fullName = getUserDisplayName(user).toLowerCase();
          return (
            fullName.includes(query) ||
            user.handle?.toLowerCase().includes(query) ||
            user.email?.toLowerCase().includes(query)
          );
        })
      : [];

  const filteredGroups =
    entityType === 'group'
      ? allGroups?.filter(group => {
          const query = searchQuery.toLowerCase();
          return group.name?.toLowerCase().includes(query);
        })
      : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that an entity is selected
    if (!selectedEntity) {
      toast.error(
        translateText(
          direction === 'income'
            ? 'features.groups.toasts.selectPayer'
            : 'features.groups.toasts.selectReceiver'
        )
      );
      return;
    }

    const paymentData: {
      label: string;
      type: string;
      amount: number;
      currency: string;
      direction: 'income' | 'expense';
      payerUserId?: string;
      payerGroupId?: string;
      receiverUserId?: string;
      receiverGroupId?: string;
    } = {
      label,
      type,
      amount: parseFloat(amount),
      currency,
      direction,
    };

    // Set payer and receiver based on direction
    if (direction === 'income') {
      // Group is receiver, selected entity is payer
      paymentData.receiverGroupId = groupId;
      if (selectedEntity.type === 'user') {
        paymentData.payerUserId = selectedEntity.id;
      } else {
        paymentData.payerGroupId = selectedEntity.id;
      }
    } else {
      // Group is payer, selected entity is receiver
      paymentData.payerGroupId = groupId;
      if (selectedEntity.type === 'user') {
        paymentData.receiverUserId = selectedEntity.id;
      } else {
        paymentData.receiverGroupId = selectedEntity.id;
      }
    }

    onSubmit(paymentData);
    setLabel('');
    setType('donation');
    setAmount('');
    setCurrency(displayCurrency);
    setSelectedEntity(null);
    setSearchQuery('');
    setEntityType('user');
  };
  return {
    open,
    onOpenChange,
    onSubmit,
    direction,
    groupId,
    label,
    setLabel,
    type,
    setType,
    amount,
    setAmount,
    currency,
    setCurrency,
    searchQuery,
    setSearchQuery,
    popoverOpen,
    setPopoverOpen,
    entityType,
    setEntityType,
    selectedEntity,
    setSelectedEntity,
    allUsers,
    allGroups,
    getUserDisplayName,
    filteredUsers,
    filteredGroups,
    handleSubmit,
  };
}

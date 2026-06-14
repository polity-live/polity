'use client';

import { useState } from 'react';
import { useUserState } from '@/zero/users/useUserState';
import { useAllGroups } from '@/zero/groups/useGroupState';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/features/shared/ui/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    label: string;
    type: string;
    amount: number;
    direction: 'income' | 'expense';
    payerUserId?: string;
    payerGroupId?: string;
    receiverUserId?: string;
    receiverGroupId?: string;
  }) => void;
  direction: 'income' | 'expense';
  groupId: string;
}

export function AddPaymentDialog({
  open,
  onOpenChange,
  onSubmit,
  direction,
  groupId,
}: AddPaymentDialogProps) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState('donation');
  const [amount, setAmount] = useState('');
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
      toast.error(`Please select a ${direction === 'income' ? 'payer' : 'receiver'}`);
      return;
    }

    const paymentData: {
      label: string;
      type: string;
      amount: number;
      direction: 'income' | 'expense';
      payerUserId?: string;
      payerGroupId?: string;
      receiverUserId?: string;
      receiverGroupId?: string;
    } = {
      label,
      type,
      amount: parseFloat(amount),
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
    setSelectedEntity(null);
    setSearchQuery('');
    setEntityType('user');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {translateText('generated.inline.0595_add_61cc55aa')}
          {direction === 'income'
            ? translateText('generated.inline.0084_income_1c89b1f2')
            : translateText('generated.inline.0085_expense_a0db8e68')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {translateText('generated.inline.0595_add_61cc55aa')}
              {direction === 'income'
                ? translateText('generated.inline.0084_income_1c89b1f2')
                : translateText('generated.inline.0085_expense_a0db8e68')}
            </DialogTitle>
            <DialogDescription>
              {translateText('generated.inline.0596_record_a_new_a49e3974')}
              {direction}
              {translateText('generated.inline.0597_transaction_for_this_group_c00821f0')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payment-label">
                {translateText('generated.inline.0535_label_74341e3c')}
              </Label>
              <Input
                id="payment-label"
                placeholder={translateText('generated.inline.0598_description_of_payment_e677bce7')}
                value={label}
                onChange={e => setLabel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-type">
                {translateText('generated.inline.0599_type_3deb7456')}
              </Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="payment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="membership_fee">
                    {translateText('generated.inline.0600_membership_fee_1fa71c2d')}
                  </SelectItem>
                  <SelectItem value="donation">
                    {translateText('generated.inline.0601_donation_2c093025')}
                  </SelectItem>
                  <SelectItem value="subsidies">
                    {translateText('generated.inline.0602_subsidies_6df12817')}
                  </SelectItem>
                  <SelectItem value="campaign">
                    {translateText('generated.inline.0603_campaign_69390e16')}
                  </SelectItem>
                  <SelectItem value="material">
                    {translateText('generated.inline.0604_material_d8169782')}
                  </SelectItem>
                  <SelectItem value="events">
                    {translateText('generated.inline.0605_events_c5497bca')}
                  </SelectItem>
                  <SelectItem value="others">
                    {translateText('generated.inline.0606_others_8d7bf5bf')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-amount">
                {translateText('generated.inline.0607_amount_0dde6c59')}
              </Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-entity">
                {direction === 'income'
                  ? translateText('generated.inline.0086_from_payer_9c4d29c7')
                  : translateText('generated.inline.0087_to_receiver_243f4d32')}
              </Label>

              {/* Toggle between User and Group */}
              <div className="mb-2 flex gap-2">
                <Button
                  type="button"
                  variant={entityType === 'user' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setEntityType('user');
                    setSelectedEntity(null);
                    setSearchQuery('');
                  }}
                  className="flex-1"
                >
                  {translateText('generated.inline.0090_user_9f8a2389')}
                </Button>
                <Button
                  type="button"
                  variant={entityType === 'group' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setEntityType('group');
                    setSelectedEntity(null);
                    setSearchQuery('');
                  }}
                  className="flex-1"
                >
                  {translateText('generated.inline.0608_group_171a0606')}
                </Button>
              </div>

              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="payment-entity"
                    variant="outline"
                    role="combobox"
                    aria-expanded={popoverOpen}
                    className="w-full justify-between"
                  >
                    {selectedEntity ? (
                      <div className="flex items-center gap-2">
                        {selectedEntity.type === 'user' && (
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-xs">
                              {selectedEntity.name[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <span>{selectedEntity.name}</span>
                        <span className="text-muted-foreground text-xs">
                          ({selectedEntity.type})
                        </span>
                      </div>
                    ) : (
                      translateText('generated.inline.0063_select_entitytype_b5ae7326', {
                        entityType: entityType,
                      })
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder={`Search ${entityType === 'user' ? 'users' : 'groups'}...`}
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {translateText('generated.inline.0609_no_816c52fd')}
                        {entityType === 'user'
                          ? translateText('generated.inline.0027_users_5b7dcd14')
                          : translateText('generated.inline.0064_groups_0a894db7')}{' '}
                        found.
                      </CommandEmpty>
                      {filteredUsers && filteredUsers.length > 0 && (
                        <CommandGroup
                          heading={translateText('generated.inline.0610_users_57f2b181')}
                        >
                          {filteredUsers.map(user => {
                            if (!user?.id) return null;
                            const userId = user.id;
                            const isSelected = selectedEntity?.id === userId;
                            return (
                              <CommandItem
                                key={userId}
                                value={`user-${userId}-${getUserDisplayName(user)}`}
                                onSelect={() => {
                                  setSelectedEntity({
                                    id: userId,
                                    name: getUserDisplayName(user),
                                    type: 'user',
                                  });
                                  setPopoverOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <div className="flex flex-1 items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    {user.avatar ? (
                                      <AvatarImage
                                        src={user.avatar}
                                        alt={getUserDisplayName(user)}
                                      />
                                    ) : null}
                                    <AvatarFallback className="text-xs">
                                      {getUserDisplayName(user)[0]?.toUpperCase() || '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">
                                      {getUserDisplayName(user)}
                                    </div>
                                    <div className="text-muted-foreground text-xs">
                                      {user.handle ? `@${user.handle}` : user.email}
                                    </div>
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check className="text-primary ml-2 h-4 w-4" strokeWidth={3} />
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      )}
                      {filteredGroups && filteredGroups.length > 0 && (
                        <CommandGroup
                          heading={translateText('generated.inline.0611_groups_ae9629f4')}
                        >
                          {filteredGroups.map(group => {
                            const isSelected = selectedEntity?.id === group.id;
                            return (
                              <CommandItem
                                key={group.id}
                                value={`group-${group.id}-${group.name}`}
                                onSelect={() => {
                                  setSelectedEntity({
                                    id: group.id,
                                    name: group.name ?? 'Unnamed',
                                    type: 'group',
                                  });
                                  setPopoverOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <div className="flex flex-1 items-center gap-2">
                                  <div className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold">
                                    {(group.name ?? '')[0]?.toUpperCase()}
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">{group.name}</div>
                                    <div className="text-muted-foreground text-xs">
                                      {group.member_count}
                                      {translateText('generated.inline.0020_members_f13eb585')}
                                    </div>
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check className="text-primary ml-2 h-4 w-4" strokeWidth={3} />
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">
              {translateText('generated.inline.0612_add_payment_b5118402')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

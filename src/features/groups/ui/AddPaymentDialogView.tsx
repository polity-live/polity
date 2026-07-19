'use client';

import {
  FormControlInput,
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
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
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { CurrencySelect } from '@/features/shared/ui/form/CurrencySelect';
import { getCurrencyFractionDigits } from '@/features/shared/logic/currency';
export interface AddPaymentDialogViewProps {
  open: any;
  onOpenChange: any;
  onSubmit: any;
  direction: any;
  groupId: any;
  label: any;
  setLabel: any;
  type: any;
  setType: any;
  amount: any;
  setAmount: any;
  currency: any;
  setCurrency: any;
  searchQuery: any;
  setSearchQuery: any;
  popoverOpen: any;
  setPopoverOpen: any;
  entityType: any;
  setEntityType: any;
  selectedEntity: any;
  setSelectedEntity: any;
  allUsers: any[];
  allGroups: any[];
  getUserDisplayName: any;
  filteredUsers: any[];
  filteredGroups: any[];
  handleSubmit: any;
}

export function AddPaymentDialogView({
  open,
  onOpenChange,
  direction,
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
  getUserDisplayName,
  filteredUsers,
  filteredGroups,
  handleSubmit,
}: AddPaymentDialogViewProps) {
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
      <ScrollableDialogContent className="sm:max-w-[500px]">
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
              <FormControlLabel htmlFor="payment-label">
                {translateText('generated.inline.0535_label_74341e3c')}
              </FormControlLabel>
              <FormControlInput
                id="payment-label"
                placeholder={translateText('generated.inline.0598_description_of_payment_e677bce7')}
                value={label}
                onChange={e => setLabel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <FormControlLabel>{translateText('pages.create.payment.currency')}</FormControlLabel>
              <CurrencySelect value={currency} onChange={setCurrency} />
            </div>
            <div className="space-y-2">
              <FormControlLabel htmlFor="payment-type">
                {translateText('generated.inline.0599_type_3deb7456')}
              </FormControlLabel>
              <FormControlSelect value={type} onValueChange={setType}>
                <FormControlSelectTrigger id="payment-type">
                  <FormControlSelectValue />
                </FormControlSelectTrigger>
                <FormControlSelectContent>
                  <FormControlSelectItem value="membership_fee">
                    {translateText('generated.inline.0600_membership_fee_1fa71c2d')}
                  </FormControlSelectItem>
                  <FormControlSelectItem value="donation">
                    {translateText('generated.inline.0601_donation_2c093025')}
                  </FormControlSelectItem>
                  <FormControlSelectItem value="subsidies">
                    {translateText('generated.inline.0602_subsidies_6df12817')}
                  </FormControlSelectItem>
                  <FormControlSelectItem value="campaign">
                    {translateText('generated.inline.0603_campaign_69390e16')}
                  </FormControlSelectItem>
                  <FormControlSelectItem value="material">
                    {translateText('generated.inline.0604_material_d8169782')}
                  </FormControlSelectItem>
                  <FormControlSelectItem value="events">
                    {translateText('generated.inline.0605_events_c5497bca')}
                  </FormControlSelectItem>
                  <FormControlSelectItem value="others">
                    {translateText('generated.inline.0606_others_8d7bf5bf')}
                  </FormControlSelectItem>
                </FormControlSelectContent>
              </FormControlSelect>
            </div>
            <div className="space-y-2">
              <FormControlLabel htmlFor="payment-amount">
                {translateText('generated.inline.0607_amount_0dde6c59')}
              </FormControlLabel>
              <FormControlInput
                id="payment-amount"
                type="number"
                step={10 ** -getCurrencyFractionDigits(currency)}
                min="0"
                placeholder={
                  getCurrencyFractionDigits(currency) === 0
                    ? '0'
                    : `0.${'0'.repeat(getCurrencyFractionDigits(currency))}`
                }
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <FormControlLabel htmlFor="payment-entity">
                {direction === 'income'
                  ? translateText('generated.inline.0086_from_payer_9c4d29c7')
                  : translateText('generated.inline.0087_to_receiver_243f4d32')}
              </FormControlLabel>

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
                          {filteredUsers.map((user: any) => {
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
                          {filteredGroups.map((group: any) => {
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
                                  <div className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold">
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
      </ScrollableDialogContent>
    </Dialog>
  );
}

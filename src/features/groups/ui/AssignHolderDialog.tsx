'use client';

import {
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { useState } from 'react';
import { useGroupActiveMembers } from '@/zero/groups/useGroupState';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/features/shared/utils/utils';
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

export function AssignHolderDialog({
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {translateText('generated.inline.0646_assign_incumbent_d397e41f')}
            </DialogTitle>
            <DialogDescription>
              {isElectedRole
                ? translateText(
                    'generated.inline.0074_title_is_an_elected_role_and_must_be_filled_t_7c021fe4',
                    { title: role?.title }
                  )
                : currentHolder
                  ? translateText(
                      'generated.inline.0075_replace_the_current_holder_of_title_with_a_ne_371157b0',
                      { title: role?.title }
                    )
                  : translateText(
                      'generated.inline.0076_assign_a_member_to_the_title_role_5e150f05',
                      { title: role?.title }
                    )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isElectedRole && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                {translateText(
                  'generated.inline.0647_start_or_complete_an_election_to_assign_this__b960eee5'
                )}
              </div>
            )}
            {currentHolder && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={currentHolder.avatar ?? undefined} />
                    <AvatarFallback>
                      {currentHolder.first_name?.[0] || currentHolder.handle?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {translateText('generated.inline.0648_current_19889c90')}
                      {currentHolder.first_name || currentHolder.handle}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {translateText('generated.inline.0649_will_be_replaced_07522d9b')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <FormControlLabel htmlFor="holder-select">
                {translateText('generated.inline.0650_select_member_09555414')}
                <span className="text-destructive">*</span>
              </FormControlLabel>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="holder-select"
                    variant="outline"
                    role="combobox"
                    aria-expanded={popoverOpen}
                    disabled={isElectedRole}
                    className="w-full justify-between"
                  >
                    {selectedMember?.user ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={selectedMember.user.avatar ?? undefined} />
                          <AvatarFallback>
                            {selectedMember.user.first_name?.[0] ||
                              selectedMember.user.handle?.[0] ||
                              'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span>{selectedMember.user.first_name || selectedMember.user.handle}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        {translateText('generated.inline.0651_select_a_member_e6903be4')}
                      </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[460px] p-0">
                  <Command>
                    <CommandInput
                      placeholder={translateText('generated.inline.0652_search_members_c698311c')}
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {translateText('generated.inline.0653_no_members_found_c02a8c65')}
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredMembers.map(membership => {
                          const user = membership.user;
                          if (!user) return null;
                          return (
                            <CommandItem
                              key={user.id}
                              value={user.id}
                              onSelect={value => {
                                setSelectedUserId(value);
                                setPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedUserId === user.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              <Avatar className="mr-2 h-8 w-8">
                                <AvatarImage src={user.avatar ?? undefined} />
                                <AvatarFallback>
                                  {user.first_name?.[0] || user.handle?.[0] || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {user.first_name || user.handle}
                                </span>
                                {user.handle && (
                                  <span className="text-muted-foreground text-xs">
                                    @{user.handle}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <FormControlLabel htmlFor="assignment-reason">
                {translateText('generated.inline.0654_assignment_reason_74518646')}
              </FormControlLabel>
              <FormControlSelect
                value={reason}
                onValueChange={value => setReason(value as 'elected' | 'appointed')}
                disabled={isElectedRole}
              >
                <FormControlSelectTrigger id="assignment-reason">
                  <FormControlSelectValue />
                </FormControlSelectTrigger>
                <FormControlSelectContent>
                  <FormControlSelectItem value="appointed">
                    {translateText('generated.inline.0655_appointed_9f51a760')}
                  </FormControlSelectItem>
                  <FormControlSelectItem value="elected">
                    {translateText('generated.inline.0656_elected_27d35d1d')}
                  </FormControlSelectItem>
                </FormControlSelectContent>
              </FormControlSelect>
              <p className="text-muted-foreground text-xs">
                {translateText(
                  'generated.inline.0657_this_will_be_recorded_in_the_role_s_history_2bd38069'
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isElectedRole
                ? translateText('generated.inline.0088_close_bbfa773e')
                : translateText('generated.inline.0089_cancel_77dfd213')}
            </Button>
            {!isElectedRole && (
              <Button type="submit">
                {currentHolder
                  ? translateText('generated.inline.0090_replace_holder_da55b9f7')
                  : translateText('generated.inline.0091_assign_holder_2a88e099')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </ScrollableDialogContent>
    </Dialog>
  );
}

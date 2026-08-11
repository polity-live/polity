'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { Check, Loader2, UserPlus, X } from 'lucide-react';

import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import { BadgeControl } from '@/features/shared/ui/status/StatusBadges';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/features/shared/ui/ui/command';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import {
  translate as translateText,
  useTranslation,
} from '@/features/shared/hooks/use-translation';

import type { InviteCollaboratorModel } from '../hooks/useInviteCollaboratorModel';

interface InviteCollaboratorDialogViewProps {
  model: InviteCollaboratorModel;
}

export function InviteCollaboratorDialogView({ model }: InviteCollaboratorDialogViewProps) {
  const {
    filteredUsers,
    handleInvite,
    isInviting,
    isLoading,
    open,
    searchQuery,
    selectedUsers,
    setOpen,
    setSearchQuery,
    toggleUserSelection,
    users,
  } = model;
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-action-id="editor.collaborator-invite.open">
          <UserPlus className="mr-2 h-4 w-4" />
          {t('features.editor.inviteDialog.invite')}
        </Button>
      </DialogTrigger>
      <ScrollableDialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('features.editor.inviteDialog.title')}</DialogTitle>
          <DialogDescription>{t('features.editor.inviteDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Selected users */}
          {selectedUsers.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {selectedUsers.map((userId: any) => {
                const user = users?.find((u: any) => u.id === userId);
                if (!user) return null;

                return (
                  <BadgeControl
                    key={userId}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                  >
                    <Avatar className="h-4 w-4">
                      {user.avatar ? (
                        <AvatarImage
                          src={user.avatar}
                          alt={[user.first_name, user.last_name].filter(Boolean).join(' ')}
                        />
                      ) : null}
                      <AvatarFallback
                        className={featureThemeClassName(
                          'editorInviteCollaboratorDialogThemedText'
                        )}
                      >
                        {user.first_name?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      {[user.first_name, user.last_name].filter(Boolean).join(' ') ||
                        user.handle ||
                        translateText('generated.inline.0066_user_9f8a2389')}
                    </span>
                    <Button
                      data-action-id="editor.collaborator-invite.selection.remove"
                      variant="ghost"
                      size="sm"
                      aria-label={t('features.editor.inviteDialog.removeSelection', 'Remove user')}
                      className={featureThemeClassName('editorInviteCollaboratorDialogThemedPanel')}
                      onClick={() => toggleUserSelection(userId)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </BadgeControl>
                );
              })}
            </div>
          )}

          {/* User search */}
          <Command className="rounded-lg border">
            <CommandInput
              placeholder={t('features.editor.inviteDialog.searchPlaceholder')}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {isLoading ? (
                <SectionSkeleton rows={3} density="compact" className="p-2" />
              ) : (
                <>
                  <CommandEmpty>{t('features.editor.inviteDialog.noUsers')}</CommandEmpty>
                  <CommandGroup>
                    {filteredUsers?.slice(0, 10).map((user: any) => {
                      const isSelected = selectedUsers.includes(user.id);

                      return (
                        <CommandItem
                          data-action-id="editor.collaborator-invite.user.toggle"
                          key={user.id}
                          value={user.id}
                          onSelect={() => toggleUserSelection(user.id)}
                          className="cursor-pointer"
                        >
                          <div className="flex flex-1 items-center gap-2">
                            <Avatar className="h-8 w-8">
                              {user.avatar ? (
                                <AvatarImage
                                  src={user.avatar}
                                  alt={
                                    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
                                    ''
                                  }
                                />
                              ) : null}
                              <AvatarFallback>
                                {user.first_name?.[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {[user.first_name, user.last_name].filter(Boolean).join(' ') ||
                                  user.handle ||
                                  translateText('generated.inline.0066_user_9f8a2389')}
                              </p>
                              {user.handle && (
                                <p className="text-muted-foreground text-xs">@{user.handle}</p>
                              )}
                            </div>
                          </div>
                          {isSelected && <Check className="text-primary h-4 w-4" />}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            data-action-id="editor.collaborator-invite.cancel"
            onClick={() => setOpen(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            data-action-id="editor.collaborator-invite.submit"
            onClick={handleInvite}
            disabled={selectedUsers.length === 0 || isInviting}
          >
            {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('features.editor.inviteDialog.invite')} ({selectedUsers.length})
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}

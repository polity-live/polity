import { featureThemeClassName } from '@/features/shared/theme';
import type { RefObject } from 'react';
import { Link } from '@tanstack/react-router';
import { Calendar, FileText, LogOut, Search, Settings, User, X } from 'lucide-react';

import { FormControlInput } from '@/features/shared/ui/form';
import { ScrollableAlertDialogContent } from '@/features/shared/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar.tsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/features/shared/ui/ui/alert-dialog.tsx';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/features/shared/ui/ui/accordion.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import { cn } from '@/features/shared/utils/utils.ts';
import type { UserMenuAmendment, UserMenuEvent, UserMenuGroup } from './logic/userMenuItems';

export type { UserMenuAmendment, UserMenuEvent, UserMenuGroup } from './logic/userMenuItems';

interface UserMenuViewLabels {
  profile: string;
  settings: string;
  groups: string;
  events: string;
  amendments: string;
  eventFallback: string;
  amendmentFallback: string;
  searchGroupsPlaceholder: string;
  searchEventsPlaceholder: string;
  searchAmendmentsPlaceholder: string;
  clear: string;
  logout: string;
  logoutConfirm: string;
  cancel: string;
}

interface UserMenuViewProps {
  className?: string;
  isMobile?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  displayName: string;
  displayEmail: string;
  displayAvatar?: string;
  userInitials: string;
  profileHref: string;
  settingsHref: string;
  groups: UserMenuGroup[];
  events: UserMenuEvent[];
  amendments: UserMenuAmendment[];
  showGroupSearch: boolean;
  showEventSearch: boolean;
  showAmendmentSearch: boolean;
  groupSearchQuery: string;
  eventSearchQuery: string;
  amendmentSearchQuery: string;
  groupSearchInputRef: RefObject<HTMLInputElement | null>;
  eventSearchInputRef: RefObject<HTMLInputElement | null>;
  amendmentSearchInputRef: RefObject<HTMLInputElement | null>;
  labels: UserMenuViewLabels;
  logoutDialogOpen: boolean;
  onLogoutDialogOpenChange: (open: boolean) => void;
  onGroupSearchChange: (query: string) => void;
  onEventSearchChange: (query: string) => void;
  onAmendmentSearchChange: (query: string) => void;
  onClearGroupSearch: () => void;
  onClearEventSearch: () => void;
  onClearAmendmentSearch: () => void;
  onLogout: () => void | Promise<void>;
}

export function UserMenuView({
  className,
  isMobile,
  open,
  onOpenChange,
  displayName,
  displayEmail,
  displayAvatar,
  userInitials,
  profileHref,
  settingsHref,
  groups,
  events,
  amendments,
  showGroupSearch,
  showEventSearch,
  showAmendmentSearch,
  groupSearchQuery,
  eventSearchQuery,
  amendmentSearchQuery,
  groupSearchInputRef,
  eventSearchInputRef,
  amendmentSearchInputRef,
  labels,
  logoutDialogOpen,
  onLogoutDialogOpenChange,
  onGroupSearchChange,
  onEventSearchChange,
  onAmendmentSearchChange,
  onClearGroupSearch,
  onClearEventSearch,
  onClearAmendmentSearch,
  onLogout,
}: UserMenuViewProps) {
  const hasGroups = groups.length > 0 || showGroupSearch;
  const hasEvents = events.length > 0 || showEventSearch;
  const hasAmendments = amendments.length > 0 || showAmendmentSearch;

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            data-user-menu-trigger
            variant="ghost"
            className={cn(
              'hover:bg-accent h-10 w-10 rounded-full p-0',
              isMobile && 'h-12 w-12',
              className
            )}
          >
            <Avatar className={cn('h-8 w-8', isMobile && 'h-10 w-10')}>
              <AvatarImage src={displayAvatar} alt={displayName} />
              <AvatarFallback className="text-xs font-medium">{userInitials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="z-50 flex max-h-[min(80dvh,var(--radix-dropdown-menu-content-available-height))] w-64 flex-col overflow-hidden"
        >
          <DropdownMenuLabel className="shrink-0 font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm leading-none font-medium">{displayName}</p>
              <p className="text-muted-foreground text-xs leading-none">{displayEmail}</p>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="shrink-0" />

          <DropdownMenuItem asChild className="shrink-0">
            <Link to={profileHref} className="flex w-full items-center">
              <User className="mr-2 h-4 w-4" />
              {labels.profile}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="shrink-0">
            <Link to={settingsHref} className="flex w-full items-center">
              <Settings className="mr-2 h-4 w-4" />
              {labels.settings}
            </Link>
          </DropdownMenuItem>

          {hasGroups || hasEvents || hasAmendments ? (
            <Accordion
              type="multiple"
              defaultValue={hasGroups ? ['groups'] : []}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
              {hasGroups ? (
                <AccordionItem value="groups" className="border-0">
                  <DropdownMenuSeparator className="shrink-0" />
                  <AccordionTrigger className="text-muted-foreground px-2 py-1.5 text-xs font-semibold hover:no-underline">
                    {labels.groups}
                  </AccordionTrigger>
                  <AccordionContent className="pb-1">
                    {showGroupSearch ? (
                      <div className="shrink-0 px-2 pb-1">
                        <div className="relative">
                          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                          <FormControlInput
                            ref={groupSearchInputRef}
                            autoFocus
                            value={groupSearchQuery}
                            onChange={event => onGroupSearchChange(event.target.value)}
                            onKeyDown={event => event.stopPropagation()}
                            onPointerDown={event => event.stopPropagation()}
                            placeholder={labels.searchGroupsPlaceholder}
                            className="h-8 pr-8 pl-8 text-xs"
                          />
                          {groupSearchQuery.length > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={onClearGroupSearch}
                              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2"
                              aria-label={labels.clear}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div
                      data-testid="user-menu-groups-list"
                      className="max-h-48 min-h-0 overflow-y-auto overscroll-contain"
                    >
                      {groups.map(group => (
                        <DropdownMenuItem key={group.id} asChild>
                          <Link
                            to="/group/$id"
                            params={{ id: group.id }}
                            className="flex w-full items-center gap-2"
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarImage
                                src={group.image_url ?? undefined}
                                alt={group.name ?? undefined}
                              />
                              <AvatarFallback
                                className={featureThemeClassName(
                                  'agendaAccreditationSectionThemedText'
                                )}
                              >
                                {group.name?.[0]?.toUpperCase() || 'G'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate text-sm">{group.name}</span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ) : null}

              {hasEvents ? (
                <AccordionItem value="events" className="border-0">
                  <DropdownMenuSeparator className="shrink-0" />
                  <AccordionTrigger className="text-muted-foreground px-2 py-1.5 text-xs font-semibold hover:no-underline">
                    {labels.events}
                  </AccordionTrigger>
                  <AccordionContent className="pb-1">
                    {showEventSearch ? (
                      <div className="shrink-0 px-2 pb-1">
                        <div className="relative">
                          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                          <FormControlInput
                            ref={eventSearchInputRef}
                            value={eventSearchQuery}
                            onChange={event => onEventSearchChange(event.target.value)}
                            onKeyDown={event => event.stopPropagation()}
                            onPointerDown={event => event.stopPropagation()}
                            placeholder={labels.searchEventsPlaceholder}
                            className="h-8 pr-8 pl-8 text-xs"
                          />
                          {eventSearchQuery.length > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={onClearEventSearch}
                              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2"
                              aria-label={labels.clear}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div
                      data-testid="user-menu-events-list"
                      className="max-h-48 min-h-0 overflow-y-auto overscroll-contain"
                    >
                      {events.map(event => (
                        <DropdownMenuItem key={event.key} asChild>
                          <Link
                            to="/event/$id"
                            params={{ id: event.id }}
                            className="flex w-full items-center gap-2"
                          >
                            <Calendar className="text-muted-foreground h-4 w-4 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">
                                {event.title || labels.eventFallback}
                              </span>
                              <span className="text-muted-foreground block truncate text-xs">
                                {formatEventMeta(event)}
                              </span>
                            </span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ) : null}

              {hasAmendments ? (
                <AccordionItem value="amendments" className="border-0">
                  <DropdownMenuSeparator className="shrink-0" />
                  <AccordionTrigger className="text-muted-foreground px-2 py-1.5 text-xs font-semibold hover:no-underline">
                    {labels.amendments}
                  </AccordionTrigger>
                  <AccordionContent className="pb-1">
                    {showAmendmentSearch ? (
                      <div className="shrink-0 px-2 pb-1">
                        <div className="relative">
                          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                          <FormControlInput
                            ref={amendmentSearchInputRef}
                            value={amendmentSearchQuery}
                            onChange={event => onAmendmentSearchChange(event.target.value)}
                            onKeyDown={event => event.stopPropagation()}
                            onPointerDown={event => event.stopPropagation()}
                            placeholder={labels.searchAmendmentsPlaceholder}
                            className="h-8 pr-8 pl-8 text-xs"
                          />
                          {amendmentSearchQuery.length > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={onClearAmendmentSearch}
                              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2"
                              aria-label={labels.clear}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div
                      data-testid="user-menu-amendments-list"
                      className="max-h-48 min-h-0 overflow-y-auto overscroll-contain"
                    >
                      {amendments.map(amendment => (
                        <DropdownMenuItem key={amendment.id} asChild>
                          <Link
                            to="/amendment/$id"
                            params={{ id: amendment.id }}
                            className="flex w-full items-center gap-2"
                          >
                            <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">
                                {amendment.title || labels.amendmentFallback}
                              </span>
                              <span className="text-muted-foreground block truncate text-xs">
                                {formatAmendmentMeta(amendment)}
                              </span>
                            </span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ) : null}
            </Accordion>
          ) : null}

          <DropdownMenuSeparator className="shrink-0" />

          <DropdownMenuItem
            onClick={() => onLogoutDialogOpenChange(true)}
            className={cn('shrink-0', featureThemeClassName('navigationUserMenuDangerText'))}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {labels.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={logoutDialogOpen} onOpenChange={onLogoutDialogOpenChange}>
        <ScrollableAlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.logout}</AlertDialogTitle>
            <AlertDialogDescription>{labels.logoutConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={onLogout}>{labels.logout}</AlertDialogAction>
          </AlertDialogFooter>
        </ScrollableAlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatEventMeta(event: UserMenuEvent) {
  return [formatEventDate(event.start_date), event.groupName, event.locationName]
    .filter(Boolean)
    .join(' - ');
}

function formatAmendmentMeta(amendment: UserMenuAmendment) {
  return [...new Set([amendment.targetGroupName, amendment.groupName, amendment.eventTitle])]
    .filter(Boolean)
    .join(' - ');
}

function formatEventDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Checkbox } from '@/features/shared/ui/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/features/shared/ui/ui/alert-dialog';
import { Trash2, UserCheck, Plus, Edit2 } from 'lucide-react';
import { useEventRoles } from '../hooks/useEventPositions';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export function EventPositions({ eventId }: { eventId: string }) {
  const { event, roles, dialogs, form, actions } = useEventRoles(eventId);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {translateText('generated.inline.1034_manage_event_roles_50c33e07')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {event?.title || translateText('generated.inline.0023_event_ad8919ac')}
          {translateText(
            'generated.inline.1035_create_and_manage_scoped_roles_for_this_event_591495d1'
          )}
        </p>
      </div>

      {/* Add Role Button */}
      <div className="mb-6 flex justify-end">
        <Dialog open={dialogs.add.open} onOpenChange={dialogs.add.setOpen}>
          <DialogTrigger asChild>
            <Button onClick={form.reset}>
              <Plus className="mr-2 h-4 w-4" />
              {translateText('generated.inline.0125_add_role_82d0afcc')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {translateText('generated.inline.1036_create_new_role_a195fa09')}
              </DialogTitle>
              <DialogDescription>
                {translateText(
                  'generated.inline.1037_create_a_scoped_role_for_this_event_e_g_sessi_073b1c46'
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">
                  {translateText('generated.inline.1038_role_title_b96976bb')}
                </Label>
                <Input
                  id="title"
                  placeholder={translateText(
                    'generated.inline.1039_e_g_session_chair_counting_committee_3f5b97dd'
                  )}
                  value={form.title}
                  onChange={e => form.setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  {translateText('generated.inline.0130_description_optional_f1da5c02')}
                </Label>
                <Textarea
                  id="description"
                  placeholder={translateText(
                    'generated.inline.1040_describe_the_responsibilities_of_this_role_13d141c1'
                  )}
                  value={form.description}
                  onChange={e => form.setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">
                  {translateText('generated.inline.1041_number_of_holders_994d4b41')}
                </Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={form.capacity}
                  onChange={e => form.setCapacity(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  {translateText(
                    'generated.inline.1042_how_many_participants_can_hold_this_position_4ca1e969'
                  )}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="create-election"
                  checked={form.createElection}
                  onCheckedChange={checked => form.setCreateElection(checked as boolean)}
                />
                <Label htmlFor="create-election" className="cursor-pointer text-sm font-normal">
                  {translateText(
                    'generated.inline.1043_create_election_agenda_item_at_the_beginning__0526faed'
                  )}
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => dialogs.add.setOpen(false)}>
                {translateText('generated.inline.0065_cancel_77dfd213')}
              </Button>
              <Button type="button" onClick={actions.add}>
                {translateText('generated.inline.0132_create_role_5bea05a8')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={dialogs.edit.open} onOpenChange={dialogs.edit.setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{translateText('generated.inline.1044_edit_role_b075b676')}</DialogTitle>
            <DialogDescription>
              {translateText('generated.inline.1045_update_the_role_details_f8b0defc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">
                {translateText('generated.inline.1038_role_title_b96976bb')}
              </Label>
              <Input
                id="edit-title"
                placeholder={translateText(
                  'generated.inline.1039_e_g_session_chair_counting_committee_3f5b97dd'
                )}
                value={form.title}
                onChange={e => form.setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">
                {translateText('generated.inline.0130_description_optional_f1da5c02')}
              </Label>
              <Textarea
                id="edit-description"
                placeholder={translateText(
                  'generated.inline.1040_describe_the_responsibilities_of_this_role_13d141c1'
                )}
                value={form.description}
                onChange={e => form.setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-capacity">
                {translateText('generated.inline.1041_number_of_holders_994d4b41')}
              </Label>
              <Input
                id="edit-capacity"
                type="number"
                min="1"
                placeholder="1"
                value={form.capacity}
                onChange={e => form.setCapacity(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                {translateText(
                  'generated.inline.1042_how_many_participants_can_hold_this_position_4ca1e969'
                )}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-create-election"
                checked={form.createElection}
                onCheckedChange={checked => form.setCreateElection(checked as boolean)}
              />
              <Label htmlFor="edit-create-election" className="cursor-pointer text-sm font-normal">
                {translateText(
                  'generated.inline.1043_create_election_agenda_item_at_the_beginning__0526faed'
                )}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => dialogs.edit.setOpen(false)}>
              {translateText('generated.inline.0065_cancel_77dfd213')}
            </Button>
            <Button type="button" onClick={actions.edit}>
              {translateText('generated.inline.1046_save_changes_fa2984b3')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roles List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {translateText('generated.inline.1047_event_roles_f6f34fc1')}
            {roles.length})
          </CardTitle>
          <CardDescription>
            {translateText(
              'generated.inline.1048_roles_for_this_event_with_their_holders_and_e_dbd572b9'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="py-12 text-center">
              <UserCheck className="text-muted-foreground/50 mx-auto h-12 w-12" />
              <p className="text-muted-foreground mt-4">
                {translateText(
                  'generated.inline.1049_no_roles_created_yet_click_add_role_to_create_359b779d'
                )}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translateText('generated.inline.0091_role_c3f104d1')}</TableHead>
                  <TableHead>{translateText('generated.inline.1050_capacity_45bd908d')}</TableHead>
                  <TableHead>
                    {translateText('generated.inline.1051_current_holders_71f3c4c3')}
                  </TableHead>
                  <TableHead>{translateText('generated.inline.1052_election_217da2dc')}</TableHead>
                  <TableHead className="text-right">
                    {translateText('generated.inline.0093_actions_c3cd636a')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map(role => {
                  const holders = role.holders || [];
                  const filledSlots = holders.length;
                  const totalSlots = 1;
                  const hasElection = false;

                  return (
                    <TableRow key={role.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{role.title}</div>
                          {role.description && (
                            <div className="text-muted-foreground line-clamp-1 text-sm">
                              {role.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {filledSlots} / {totalSlots}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {holders.length > 0 ? (
                          <div className="flex -space-x-2">
                            {holders.slice(0, 3).map(holder => (
                              <Avatar
                                key={holder.id}
                                className="border-background h-8 w-8 border-2"
                              >
                                <AvatarImage
                                  src={holder.user?.avatar ?? undefined}
                                  alt={
                                    [holder.user?.first_name, holder.user?.last_name]
                                      .filter(Boolean)
                                      .join(' ') || undefined
                                  }
                                />
                                <AvatarFallback>
                                  {holder.user?.first_name?.[0]?.toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {holders.length > 3 && (
                              <div className="border-background bg-muted flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium">
                                +{holders.length - 3}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {translateText('generated.inline.1053_no_holders_yet_40094d22')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasElection ? (
                          <Badge variant="secondary">
                            <UserCheck className="mr-1 h-3 w-3" />
                            {translateText('generated.inline.1052_election_217da2dc')}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {translateText('generated.inline.1054_manual_4e836fdc')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => actions.openEdit(role)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="text-destructive h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {translateText('generated.inline.1055_delete_role_af587987')}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {translateText(
                                    'generated.inline.1056_are_you_sure_you_want_to_delete_727effd6'
                                  )}
                                  {role.title}
                                  {translateText(
                                    'generated.inline.1057_this_action_cannot_be_undone_03284dff'
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {translateText('generated.inline.0065_cancel_77dfd213')}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => actions.delete(role.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {translateText('generated.inline.0537_delete_f6fdbe48')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

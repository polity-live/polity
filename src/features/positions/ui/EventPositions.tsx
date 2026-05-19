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

export function EventPositions({ eventId }: { eventId: string }) {
  const { event, roles, dialogs, form, actions } = useEventRoles(eventId);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Manage Event Roles</h1>
        <p className="text-muted-foreground mt-2">
          {event?.title || 'Event'} - Create and manage scoped roles for this event
        </p>
      </div>

      {/* Add Role Button */}
      <div className="mb-6 flex justify-end">
        <Dialog open={dialogs.add.open} onOpenChange={dialogs.add.setOpen}>
          <DialogTrigger asChild>
            <Button onClick={form.reset}>
              <Plus className="mr-2 h-4 w-4" />
              Add Role
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>
                Create a scoped role for this event (e.g., Session Chair, Counting Committee).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Role Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Session Chair, Counting Committee"
                  value={form.title}
                  onChange={e => form.setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the responsibilities of this role"
                  value={form.description}
                  onChange={e => form.setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Number of Holders *</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={form.capacity}
                  onChange={e => form.setCapacity(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  How many participants can hold this position
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="create-election"
                  checked={form.createElection}
                  onCheckedChange={checked => form.setCreateElection(checked as boolean)}
                />
                <Label htmlFor="create-election" className="cursor-pointer text-sm font-normal">
                  Create election agenda item at the beginning of the event
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => dialogs.add.setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={actions.add}>
                Create Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={dialogs.edit.open} onOpenChange={dialogs.edit.setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update the role details.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Role Title *</Label>
              <Input
                id="edit-title"
                placeholder="e.g., Session Chair, Counting Committee"
                value={form.title}
                onChange={e => form.setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                placeholder="Describe the responsibilities of this role"
                value={form.description}
                onChange={e => form.setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-capacity">Number of Holders *</Label>
              <Input
                id="edit-capacity"
                type="number"
                min="1"
                placeholder="1"
                value={form.capacity}
                onChange={e => form.setCapacity(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                How many participants can hold this position
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-create-election"
                checked={form.createElection}
                onCheckedChange={checked => form.setCreateElection(checked as boolean)}
              />
              <Label htmlFor="edit-create-election" className="cursor-pointer text-sm font-normal">
                Create election agenda item at the beginning of the event
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => dialogs.edit.setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={actions.edit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roles List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Event Roles ({roles.length})
          </CardTitle>
          <CardDescription>
            Roles for this event with their holders and election settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="py-12 text-center">
              <UserCheck className="text-muted-foreground/50 mx-auto h-12 w-12" />
              <p className="text-muted-foreground mt-4">
                No roles created yet. Click 'Add Role' to create your first role.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Current Holders</TableHead>
                  <TableHead>Election</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                          <span className="text-muted-foreground text-sm">No holders yet</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasElection ? (
                          <Badge variant="secondary">
                            <UserCheck className="mr-1 h-3 w-3" />
                            Election
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Manual</span>
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
                                <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete '{role.title}'? This action cannot
                                  be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => actions.delete(role.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
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

/**
 * Add Role Dialog Component
 *
 * Dialog for creating a new role in the group.
 */

import { Button } from '@/features/shared/ui/ui/button';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { ValidatedInputField } from '@/features/shared/ui/form/ValidatedInputField';
import { Label } from '@/features/shared/ui/ui/label';
import { RadioGroup, RadioGroupItem } from '@/features/shared/ui/ui/radio-group';
import { Switch } from '@/features/shared/ui/ui/switch';
import { VisibilitySelector } from '@/features/shared/ui/ui/visibility-selector';
import { RecurringPatternInput } from '@/features/create/ui/inputs/RecurringPatternInput';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { CheckCircle2, Plus } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import type { RoleEditorFormState } from '../types/group.types';

interface AddRoleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: RoleEditorFormState;
  onFormChange: (patch: Partial<RoleEditorFormState>) => void;
  onSubmit: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  trigger?: React.ReactNode | null;
  scope?: 'group' | 'event';
  eventType?: string | null;
  guestOnlyMembershipFlow?: boolean;
}

export function AddRoleDialog({
  isOpen,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  title = 'Add New Role',
  description = 'Create a new role with custom permissions, visibility, and term settings for this group.',
  submitLabel = 'Create Role',
  trigger,
  scope = 'group',
  eventType = null,
  guestOnlyMembershipFlow = false,
}: AddRoleDialogProps) {
  const isEventScope = scope === 'event';
  const allowGuestRequestDefault =
    (isEventScope && (eventType === 'general_assembly' || eventType === 'delegate_assembly')) ||
    (!isEventScope && guestOnlyMembershipFlow);
  const allowGuestInviteDefault =
    (isEventScope && (eventType === 'general_assembly' || eventType === 'delegate_assembly')) ||
    (!isEventScope && guestOnlyMembershipFlow);
  const requestRoleDisabled = allowGuestRequestDefault
    ? form.assignee_kind !== 'guest'
    : form.assignee_kind === 'guest';
  const inviteRoleDisabled = allowGuestInviteDefault
    ? form.assignee_kind !== 'guest'
    : form.assignee_kind === 'guest';
  const assignmentSectionDescription = isEventScope
    ? 'Decide whether the role is filled directly or by election and who can see it.'
    : 'Decide whether the role is filled directly or by election, who can see it, and how term renewals should work.';
  const guestRoleHint = isEventScope
    ? 'Guest roles are useful for visitors and observers. In assemblies, only guest roles can be used as invite and request defaults.'
    : guestOnlyMembershipFlow
      ? 'This sibling group uses guest-only invite and request defaults. Only guest roles can be marked as default roles here.'
      : 'Guest roles can be used in the Guests tab, but they are excluded from official membership invitations and member counts.';
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {trigger === undefined ? (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Role
          </Button>
        </DialogTrigger>
      ) : trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}
      <DialogContent className="!flex !max-h-[calc(100vh-2rem)] !max-w-3xl !flex-col !overflow-hidden sm:!max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
          <div className="space-y-4 px-5 pb-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="mb-4 space-y-1">
                <h3 className="text-sm font-semibold">Role identity</h3>
                <p className="text-muted-foreground text-sm">
                  Use a clear public name and summary so members immediately understand what the
                  role is for.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <ValidatedInputField
                    id="role-name"
                    label="Role Name"
                    value={form.name}
                    onChange={value => onFormChange({ name: value })}
                    placeholder="e.g., Moderator, Editor, Treasurer"
                    hint="Choose a short name members will recognize in tables and dialogs."
                    validator={value => value.trim().length >= 2}
                    showHint="always"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="role-description" className="text-sm font-medium">
                    Description
                  </label>
                  <Textarea
                    id="role-description"
                    placeholder="Describe what this role does and how it should be used"
                    value={form.description}
                    onChange={e => onFormChange({ description: e.target.value })}
                    className={getValidatedSurfaceClassName(form.description.trim().length > 0)}
                  />
                  <p
                    className={cn(
                      'text-xs',
                      form.description.trim().length > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground'
                    )}
                  >
                    Explain when members should choose this role and what responsibilities come with
                    it.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-muted/20 rounded-2xl border border-emerald-500/15 p-4">
              <div className="mb-4 space-y-1">
                <h3 className="text-sm font-semibold">Assignment and timing</h3>
                <p className="text-muted-foreground text-sm">{assignmentSectionDescription}</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label>Access type</Label>
                  <RadioGroup
                    value={form.assignee_kind}
                    onValueChange={value =>
                      onFormChange({
                        assignee_kind: value as RoleEditorFormState['assignee_kind'],
                      })
                    }
                  >
                    <div className="grid gap-2 md:grid-cols-2">
                      {[
                        {
                          value: 'member',
                          label: 'Official members',
                          description:
                            'Use this role for official members and inherited membership structures.',
                        },
                        {
                          value: 'guest',
                          label: 'Guests',
                          description:
                            'Use this role for invited guests who need permissions without becoming members.',
                        },
                      ].map(option => (
                        <Label
                          key={option.value}
                          htmlFor={`role-assignee-kind-${option.value}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            form.assignee_kind === option.value
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <RadioGroupItem
                            value={option.value}
                            id={`role-assignee-kind-${option.value}`}
                            className="mt-0.5"
                          />
                          <div>
                            <div className="text-sm font-medium">{option.label}</div>
                            <div className="text-muted-foreground text-xs">
                              {option.description}
                            </div>
                          </div>
                        </Label>
                      ))}
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label>Assignment</Label>
                  <RadioGroup
                    value={form.assignment_mode}
                    onValueChange={value =>
                      onFormChange({
                        assignment_mode: value as RoleEditorFormState['assignment_mode'],
                      })
                    }
                  >
                    <div className="grid gap-2 md:grid-cols-2">
                      {[
                        {
                          value: 'assigned',
                          label: 'Assigned',
                          description: 'Admins can place members directly into this role.',
                        },
                        {
                          value: 'elected',
                          label: 'Elected',
                          description: 'The role should normally be filled through an election.',
                        },
                      ].map(option => (
                        <Label
                          key={option.value}
                          htmlFor={`role-assignment-${option.value}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            form.assignment_mode === option.value
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <RadioGroupItem
                            value={option.value}
                            id={`role-assignment-${option.value}`}
                            className="mt-0.5"
                          />
                          <div>
                            <div className="text-sm font-medium">{option.label}</div>
                            <div className="text-muted-foreground text-xs">
                              {option.description}
                            </div>
                          </div>
                        </Label>
                      ))}
                    </div>
                  </RadioGroup>
                </div>

                <VisibilitySelector
                  value={form.visibility}
                  onChange={value => onFormChange({ visibility: value })}
                  showTooltip
                />

                {isEventScope ? null : (
                  <>
                    <RecurringPatternInput
                      value={form.term_pattern}
                      onChange={pattern =>
                        onFormChange({
                          term_pattern: pattern as RoleEditorFormState['term_pattern'],
                          term_interval: pattern === 'none' ? 1 : form.term_interval,
                        })
                      }
                      interval={form.term_interval}
                      onIntervalChange={interval => onFormChange({ term_interval: interval })}
                      allowedPatterns={['none', 'yearly', 'four-yearly']}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <ValidatedInputField
                        id="role-term-start"
                        label="Term starts"
                        type="date"
                        value={form.term_start_date}
                        onChange={value => onFormChange({ term_start_date: value })}
                        hint="Anchor recurring terms to the first expected start date."
                        valid={Boolean(form.term_start_date)}
                        showHint="always"
                      />
                      <ValidatedInputField
                        id="role-next-revote"
                        label="Next revote"
                        type="date"
                        value={form.scheduled_revote_date}
                        onChange={value => onFormChange({ scheduled_revote_date: value })}
                        hint="Optional. Set this if you already know the next revote milestone."
                        valid={Boolean(form.scheduled_revote_date)}
                        showHint="always"
                      />
                    </div>
                  </>
                )}
                {form.assignee_kind === 'guest' ? (
                  <p className="text-muted-foreground text-xs">{guestRoleHint}</p>
                ) : null}
              </div>
            </div>
            <div className="bg-muted/20 rounded-2xl border border-emerald-500/15 p-4">
              <div className="mb-4 space-y-1">
                <h3 className="text-sm font-semibold">Membership defaults</h3>
                <p className="text-muted-foreground text-sm">
                  Decide which role should be preselected for incoming requests and invites.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-start justify-between gap-4 rounded-xl border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Default request role
                    </div>
                    <p className="text-muted-foreground text-xs">
                      New membership requests will target this role unless a flow overrides it
                      explicitly.
                    </p>
                  </div>
                  <Switch
                    checked={requestRoleDisabled ? false : form.default_request_role}
                    disabled={requestRoleDisabled}
                    onCheckedChange={checked =>
                      onFormChange({ default_request_role: checked === true })
                    }
                  />
                </label>
                <label className="flex items-start justify-between gap-4 rounded-xl border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4 text-sky-600" />
                      Default invite role
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Invite dialogs will preselect this role for new invitations.
                    </p>
                  </div>
                  <Switch
                    checked={inviteRoleDisabled ? false : form.default_invite_role}
                    disabled={inviteRoleDisabled}
                    onCheckedChange={checked =>
                      onFormChange({ default_invite_role: checked === true })
                    }
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="px-6 pb-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getValidatedSurfaceClassName(isValid: boolean) {
  return cn(
    isValid && 'border-emerald-500 text-emerald-950 dark:border-emerald-400 dark:text-emerald-50'
  );
}

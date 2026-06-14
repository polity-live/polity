import {
  FormControlTextarea,
  FormControlLabel,
  FormControlRadioGroup,
  FormControlSwitch,
  FormControlRadioGroupItem,
} from '@/features/shared/ui/form';
/**
 * Add Role Dialog Component
 *
 * Dialog for creating a new role in the group.
 */

import { Button } from '@/features/shared/ui/ui/button';
import { ValidatedInputField } from '@/features/shared/ui/form/ValidatedInputField';
import { VisibilitySelector } from '@/features/shared/ui/form';
import { RecurringPatternInput } from '@/features/create/ui/inputs/RecurringPatternInput';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { CheckCircle2, Plus } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import type { RoleEditorFormState } from '../types/group.types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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
  title = translateText('generated.inline.0065_add_new_role_241eb33f'),
  description = translateText(
    'generated.inline.0066_create_a_new_role_with_custom_permissions_vis_fbaf6961'
  ),
  submitLabel = translateText('generated.inline.0067_create_role_5bea05a8'),
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
    ? translateText('generated.inline.0068_decide_whether_the_role_is_filled_directly_or_f2e20a4c')
    : translateText('generated.inline.0069_decide_whether_the_role_is_filled_directly_or_e909f5ee');
  const guestRoleHint = isEventScope
    ? translateText('generated.inline.0070_guest_roles_are_useful_for_visitors_and_obser_4c661647')
    : guestOnlyMembershipFlow
      ? translateText(
          'generated.inline.0071_this_sibling_group_uses_guest_only_invite_and_a8bd7534'
        )
      : translateText(
          'generated.inline.0072_guest_roles_can_be_used_in_the_guests_tab_but_fcd99186'
        );
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {trigger === undefined ? (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {translateText('generated.inline.0125_add_role_82d0afcc')}
          </Button>
        </DialogTrigger>
      ) : trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}
      <ScrollableDialogContent className="!flex !max-h-[calc(100vh-2rem)] !max-w-3xl !flex-col !overflow-hidden sm:!max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
          <div className="space-y-4 px-5 pb-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="mb-4 space-y-1">
                <h3 className="text-sm font-semibold">
                  {translateText('generated.inline.0613_role_identity_67f0fa07')}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {translateText(
                    'generated.inline.0614_use_a_clear_public_name_and_summary_so_member_55570ccb'
                  )}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <ValidatedInputField
                    id="role-name"
                    label={translateText('generated.inline.0128_role_name_a8b23a08')}
                    value={form.name}
                    onChange={value => onFormChange({ name: value })}
                    placeholder={translateText(
                      'generated.inline.0615_e_g_moderator_editor_treasurer_917802bf'
                    )}
                    hint={translateText(
                      'generated.inline.0616_choose_a_short_name_members_will_recognize_in_e089ee04'
                    )}
                    validator={value => value.trim().length >= 2}
                    showHint="always"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="role-description" className="text-sm font-medium">
                    {translateText('generated.inline.0030_description_55f8ebc8')}
                  </label>
                  <FormControlTextarea
                    id="role-description"
                    placeholder={translateText(
                      'generated.inline.0617_describe_what_this_role_does_and_how_it_shoul_e5a3b6d4'
                    )}
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
                    {translateText(
                      'generated.inline.0618_explain_when_members_should_choose_this_role__bc6d41bb'
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-muted/20 rounded-2xl border border-emerald-500/15 p-4">
              <div className="mb-4 space-y-1">
                <h3 className="text-sm font-semibold">
                  {translateText('generated.inline.0619_assignment_and_timing_a11f7685')}
                </h3>
                <p className="text-muted-foreground text-sm">{assignmentSectionDescription}</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-3">
                  <FormControlLabel>
                    {translateText('generated.inline.0620_access_type_6f01b1a4')}
                  </FormControlLabel>
                  <FormControlRadioGroup
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
                          label: translateText('generated.inline.0152_official_members_2c2be635'),
                          description: translateText(
                            'generated.inline.0153_use_this_role_for_official_members_and_inheri_084d0480'
                          ),
                        },
                        {
                          value: 'guest',
                          label: translateText('generated.inline.0154_guests_3c23a670'),
                          description: translateText(
                            'generated.inline.0155_use_this_role_for_invited_guests_who_need_per_ae19faee'
                          ),
                        },
                      ].map(option => (
                        <FormControlLabel
                          key={option.value}
                          htmlFor={`role-assignee-kind-${option.value}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            form.assignee_kind === option.value
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <FormControlRadioGroupItem
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
                        </FormControlLabel>
                      ))}
                    </div>
                  </FormControlRadioGroup>
                </div>

                <div className="space-y-3">
                  <FormControlLabel>
                    {translateText('generated.inline.0621_assignment_e55df441')}
                  </FormControlLabel>
                  <FormControlRadioGroup
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
                          label: translateText('generated.inline.0156_assigned_e24e824b'),
                          description: translateText(
                            'generated.inline.0157_admins_can_place_members_directly_into_this_r_a2a00e47'
                          ),
                        },
                        {
                          value: 'elected',
                          label: translateText('generated.inline.0081_elected_27d35d1d'),
                          description: translateText(
                            'generated.inline.0158_the_role_should_normally_be_filled_through_an_0a0e927a'
                          ),
                        },
                      ].map(option => (
                        <FormControlLabel
                          key={option.value}
                          htmlFor={`role-assignment-${option.value}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            form.assignment_mode === option.value
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <FormControlRadioGroupItem
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
                        </FormControlLabel>
                      ))}
                    </div>
                  </FormControlRadioGroup>
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
                        label={translateText('generated.inline.0622_term_starts_cd3dcce4')}
                        type="date"
                        value={form.term_start_date}
                        onChange={value => onFormChange({ term_start_date: value })}
                        hint={translateText(
                          'generated.inline.0623_anchor_recurring_terms_to_the_first_expected__cb0a2ea4'
                        )}
                        valid={Boolean(form.term_start_date)}
                        showHint="always"
                      />
                      <ValidatedInputField
                        id="role-next-revote"
                        label={translateText('generated.inline.0624_next_revote_ec9a98d0')}
                        type="date"
                        value={form.scheduled_revote_date}
                        onChange={value => onFormChange({ scheduled_revote_date: value })}
                        hint={translateText(
                          'generated.inline.0625_optional_set_this_if_you_already_know_the_nex_04129027'
                        )}
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
                <h3 className="text-sm font-semibold">
                  {translateText('generated.inline.0626_membership_defaults_e7e5326a')}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {translateText(
                    'generated.inline.0627_decide_which_role_should_be_preselected_for_i_144b6dbd'
                  )}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-start justify-between gap-4 rounded-xl border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {translateText('generated.inline.0628_default_request_role_2ffe5004')}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {translateText(
                        'generated.inline.0629_new_membership_requests_will_target_this_role_9e942d72'
                      )}
                    </p>
                  </div>
                  <FormControlSwitch
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
                      {translateText('generated.inline.0630_default_invite_role_641e8d6f')}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {translateText(
                        'generated.inline.0631_invite_dialogs_will_preselect_this_role_for_n_67574ea5'
                      )}
                    </p>
                  </div>
                  <FormControlSwitch
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
            {translateText('generated.inline.0065_cancel_77dfd213')}
          </Button>
          <Button type="button" onClick={onSubmit}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}

function getValidatedSurfaceClassName(isValid: boolean) {
  return cn(
    isValid && 'border-emerald-500 text-emerald-950 dark:border-emerald-400 dark:text-emerald-50'
  );
}

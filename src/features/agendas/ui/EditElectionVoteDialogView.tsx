'use client';

import {
  FormControlInput,
  FormControlTextarea,
  FormControlLabel,
  FormControlSelect,
  FormControlRadioGroup,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
  FormControlRadioGroupItem,
} from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import { Loader2, Plus, X } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { BallotVisibilityInput } from './BallotVisibilityInput';
export interface EditElectionVoteDialogViewProps {
  open: any;
  onOpenChange: any;
  agendaItemId: any;
  agendaItemTitle: any;
  agendaItemDescription: any;
  agendaItemDuration: any;
  election: any;
  vote: any;
  choices: any[];
  t: any;
  agendaActions: any;
  electionActions: any;
  voteActionsHook: any;
  isElection: any;
  entity: any;
  majorityType: any;
  setMajorityType: any;
  closingType: any;
  setClosingType: any;
  closingDuration: any;
  setClosingDuration: any;
  visibility: any;
  setVisibility: any;
  ballotVisibility: any;
  setBallotVisibility: any;
  maxVotes: any;
  setMaxVotes: any;
  title: any;
  setTitle: any;
  description: any;
  setDescription: any;
  duration: any;
  setDuration: any;
  localChoices: any[];
  setLocalChoices: any;
  newChoiceLabel: any;
  setNewChoiceLabel: any;
  saving: any;
  setSaving: any;
  handleAddChoice: any;
  handleRemoveChoice: any;
  handleSave: any;
}

export function EditElectionVoteDialogView({
  open,
  onOpenChange,
  t,
  isElection,
  majorityType,
  setMajorityType,
  closingType,
  setClosingType,
  closingDuration,
  setClosingDuration,
  visibility,
  setVisibility,
  ballotVisibility,
  setBallotVisibility,
  maxVotes,
  setMaxVotes,
  title,
  setTitle,
  description,
  setDescription,
  duration,
  setDuration,
  localChoices,
  newChoiceLabel,
  setNewChoiceLabel,
  saving,
  handleAddChoice,
  handleRemoveChoice,
  handleSave,
}: EditElectionVoteDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isElection
              ? t('features.events.agenda.editElectionSettings')
              : t('features.events.agenda.editVoteSettings')}
          </DialogTitle>
          <DialogDescription>
            {t('features.events.agenda.editSettingsDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <FormControlLabel htmlFor="agenda-title">
              {t('features.events.agenda.item.title')}
            </FormControlLabel>
            <FormControlInput
              id="agenda-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('features.events.agenda.editItemTitlePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <FormControlLabel htmlFor="agenda-description">
              {t('features.events.agenda.item.description')}
            </FormControlLabel>
            <FormControlTextarea
              id="agenda-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder={t('features.events.agenda.editItemDescriptionPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <FormControlLabel htmlFor="agenda-duration">
              {t('features.events.agenda.duration')}
            </FormControlLabel>
            <FormControlInput
              id="agenda-duration"
              type="number"
              min={1}
              max={480}
              value={duration}
              onChange={e => setDuration(Number(e.target.value) || 1)}
            />
          </div>

          {/* Majority type */}
          <div className="space-y-2">
            <FormControlLabel>{t('features.events.agenda.majorityType')}</FormControlLabel>
            <FormControlSelect value={majorityType} onValueChange={setMajorityType}>
              <FormControlSelectTrigger>
                <FormControlSelectValue />
              </FormControlSelectTrigger>
              <FormControlSelectContent>
                <FormControlSelectItem value="relative">
                  {t('features.events.agenda.majorityRelative')}
                </FormControlSelectItem>
                <FormControlSelectItem value="absolute">
                  {t('features.events.agenda.majorityAbsolute')}
                </FormControlSelectItem>
                <FormControlSelectItem value="two_thirds_absolute">
                  {t('features.events.agenda.majorityTwoThirds')}
                </FormControlSelectItem>
              </FormControlSelectContent>
            </FormControlSelect>
          </div>

          {/* Closing type */}
          <div className="space-y-2">
            <FormControlLabel>{t('features.events.agenda.closingType')}</FormControlLabel>
            <FormControlRadioGroup value={closingType} onValueChange={setClosingType}>
              <div className="flex items-center space-x-2">
                <FormControlRadioGroupItem value="moderator" id="closing-moderator" />
                <FormControlLabel htmlFor="closing-moderator">
                  {t('features.events.agenda.closingModerator')}
                </FormControlLabel>
              </div>
              <div className="flex items-center space-x-2">
                <FormControlRadioGroupItem value="time" id="closing-time" />
                <FormControlLabel htmlFor="closing-time">
                  {t('features.events.agenda.closingTime')}
                </FormControlLabel>
              </div>
            </FormControlRadioGroup>
          </div>

          {/* Duration (only when time-based) */}
          {closingType === 'time' && (
            <div className="space-y-2">
              <FormControlLabel>{t('features.events.agenda.closingDuration')}</FormControlLabel>
              <FormControlInput
                type="number"
                min={1}
                max={120}
                value={closingDuration}
                onChange={e => setClosingDuration(Number(e.target.value) || 1)}
              />
            </div>
          )}

          {/* Visibility */}
          <VisibilityInput value={visibility} onChange={setVisibility} />

          <BallotVisibilityInput
            value={ballotVisibility}
            onChange={setBallotVisibility}
            hint={translateText(
              'generated.inline.0048_geheime_abstimmungen_bleiben_aggregiert_namen_aa853b0e'
            )}
          />

          {/* Max votes (elections only) */}
          {isElection && (
            <div className="space-y-2">
              <FormControlLabel>{t('features.events.agenda.maxVotes')}</FormControlLabel>
              <FormControlInput
                type="number"
                min={1}
                value={maxVotes}
                onChange={e => setMaxVotes(Number(e.target.value) || 1)}
              />
            </div>
          )}

          {/* Choices list (votes only) */}
          {!isElection && (
            <div className="space-y-2">
              <FormControlLabel>{t('features.events.agenda.choices')}</FormControlLabel>
              <div className="space-y-2">
                {localChoices.map((choice: any) => (
                  <div key={choice.id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm">{choice.label}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => handleRemoveChoice(choice.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <FormControlInput
                    placeholder={t('features.events.agenda.newChoice')}
                    value={newChoiceLabel}
                    onChange={e => setNewChoiceLabel(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChoice();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleAddChoice}
                    disabled={!newChoiceLabel.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('common.actions.save')}
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}

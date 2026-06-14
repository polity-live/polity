'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';
import { RadioGroup, RadioGroupItem } from '@/features/shared/ui/ui/radio-group';
import { Loader2, Plus, X } from 'lucide-react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useVoteActions } from '@/zero/votes/useVoteActions';
import { type Visibility } from '@/features/auth/logic/checkEntityAccess';
import {
  resolveElectionBallotVisibility,
  resolveVoteBallotVisibility,
  type BallotVisibility,
} from '@/zero/shared';
import { BallotVisibilityInput } from './BallotVisibilityInput';

// ─── Types ───────────────────────────────────────────────────────────

interface ElectionSettings {
  id: string;
  majority_type?: string | null;
  closing_type?: string | null;
  closing_duration_seconds?: number | null;
  visibility?: string | null;
  ballot_visibility?: string | null;
  max_votes?: number;
}

interface VoteSettings {
  id: string;
  majority_type?: string | null;
  closing_type?: string | null;
  closing_duration_seconds?: number | null;
  visibility?: string | null;
  ballot_visibility?: string | null;
}

interface VoteChoice {
  id: string;
  label: string | null;
  order_index: number | null;
}

interface EditElectionVoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendaItemId?: string;
  agendaItemTitle?: string | null;
  agendaItemDescription?: string | null;
  agendaItemDuration?: number | null;
  /** Set for election agenda items */
  election?: ElectionSettings | null;
  /** Set for vote agenda items */
  vote?: VoteSettings | null;
  /** Current choices (for votes only) */
  choices?: VoteChoice[];
}

export function EditElectionVoteDialog({
  open,
  onOpenChange,
  agendaItemId,
  agendaItemTitle,
  agendaItemDescription,
  agendaItemDuration,
  election,
  vote,
  choices = [],
}: EditElectionVoteDialogProps) {
  const { t } = useTranslation();
  const agendaActions = useAgendaActions();
  const electionActions = useElectionActions();
  const voteActionsHook = useVoteActions();

  const isElection = !!election;
  const entity = election || vote;

  // Local form state
  const [majorityType, setMajorityType] = useState(entity?.majority_type || 'relative');
  const [closingType, setClosingType] = useState(entity?.closing_type || 'moderator');
  const [closingDuration, setClosingDuration] = useState(
    entity?.closing_duration_seconds ? Math.round(entity.closing_duration_seconds / 60) : 5
  );
  const [visibility, setVisibility] = useState<Visibility>(
    (entity?.visibility as Visibility) ?? 'public'
  );
  const [ballotVisibility, setBallotVisibility] = useState<BallotVisibility>(
    isElection
      ? resolveElectionBallotVisibility(entity?.ballot_visibility)
      : resolveVoteBallotVisibility(entity?.ballot_visibility)
  );
  const [maxVotes, setMaxVotes] = useState(election?.max_votes ?? 1);
  const [title, setTitle] = useState(agendaItemTitle ?? '');
  const [description, setDescription] = useState(agendaItemDescription ?? '');
  const [duration, setDuration] = useState(
    typeof agendaItemDuration === 'number' && agendaItemDuration > 0 ? agendaItemDuration : 30
  );
  const [localChoices, setLocalChoices] = useState<VoteChoice[]>(choices);
  const [newChoiceLabel, setNewChoiceLabel] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync state when dialog opens or entity changes
  useEffect(() => {
    if (!open) {
      return;
    }

    if (entity) {
      setMajorityType(entity.majority_type || 'relative');
      setClosingType(entity.closing_type || 'moderator');
      setClosingDuration(
        entity.closing_duration_seconds ? Math.round(entity.closing_duration_seconds / 60) : 5
      );
      setVisibility((entity.visibility as Visibility) ?? 'public');
      setBallotVisibility(
        isElection
          ? resolveElectionBallotVisibility(entity.ballot_visibility)
          : resolveVoteBallotVisibility(entity.ballot_visibility)
      );
    }

    if (isElection && election) {
      setMaxVotes(election.max_votes ?? 1);
    }

    setTitle(agendaItemTitle ?? '');
    setDescription(agendaItemDescription ?? '');
    setDuration(
      typeof agendaItemDuration === 'number' && agendaItemDuration > 0 ? agendaItemDuration : 30
    );
    setLocalChoices(choices);
    setNewChoiceLabel('');
  }, [
    open,
    entity,
    isElection,
    election,
    agendaItemTitle,
    agendaItemDescription,
    agendaItemDuration,
    choices,
  ]);

  const handleAddChoice = () => {
    const label = newChoiceLabel.trim();
    if (!label) return;
    setLocalChoices(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label,
        order_index: prev.length,
      },
    ]);
    setNewChoiceLabel('');
  };

  const handleRemoveChoice = (id: string) => {
    setLocalChoices(prev => prev.filter(c => c.id !== id));
  };

  const handleSave = async () => {
    if (!agendaItemId && !entity) return;
    setSaving(true);
    try {
      const durationSeconds = closingType === 'time' ? closingDuration * 60 : null;
      const normalizedTitle = title.trim() || null;
      const normalizedDescription = description.trim() || null;
      const normalizedDuration = Number.isFinite(duration) ? Math.max(1, duration) : 30;

      if (agendaItemId) {
        await agendaActions.updateAgendaItem({
          id: agendaItemId,
          title: normalizedTitle,
          description: normalizedDescription,
          duration: normalizedDuration,
        });
      }

      if (isElection && election) {
        await electionActions.updateElection({
          id: election.id,
          description: normalizedDescription,
          majority_type: majorityType,
          closing_type: closingType,
          closing_duration_seconds: durationSeconds,
          visibility,
          ballot_visibility: ballotVisibility,
          max_votes: maxVotes,
        });
      } else if (vote) {
        await voteActionsHook.updateVote({
          id: vote.id,
          description: normalizedDescription,
          majority_type: majorityType,
          closing_type: closingType,
          closing_duration_seconds: durationSeconds,
          visibility,
          ballot_visibility: ballotVisibility,
        });

        // Sync choices — add new, remove deleted
        const existingIds = new Set(choices.map(c => c.id));
        const localIds = new Set(localChoices.map(c => c.id));

        // Add new choices
        for (const lc of localChoices) {
          if (!existingIds.has(lc.id)) {
            await voteActionsHook.createVoteChoice({
              id: lc.id,
              vote_id: vote.id,
              label: lc.label,
              order_index: lc.order_index,
            });
          }
        }

        // Remove deleted choices
        for (const ec of choices) {
          if (!localIds.has(ec.id)) {
            await voteActionsHook.deleteVoteChoice(ec.id);
          }
        }
      }

      onOpenChange(false);
    } catch {
      // toast handled by action hooks
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
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
            <Label htmlFor="agenda-title">{t('features.events.agenda.item.title')}</Label>
            <Input
              id="agenda-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('features.events.agenda.editItemTitlePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agenda-description">
              {t('features.events.agenda.item.description')}
            </Label>
            <Textarea
              id="agenda-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder={t('features.events.agenda.editItemDescriptionPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agenda-duration">{t('features.events.agenda.duration')}</Label>
            <Input
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
            <Label>{t('features.events.agenda.majorityType')}</Label>
            <Select value={majorityType} onValueChange={setMajorityType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relative">
                  {t('features.events.agenda.majorityRelative')}
                </SelectItem>
                <SelectItem value="absolute">
                  {t('features.events.agenda.majorityAbsolute')}
                </SelectItem>
                <SelectItem value="two_thirds_absolute">
                  {t('features.events.agenda.majorityTwoThirds')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Closing type */}
          <div className="space-y-2">
            <Label>{t('features.events.agenda.closingType')}</Label>
            <RadioGroup value={closingType} onValueChange={setClosingType}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="moderator" id="closing-moderator" />
                <Label htmlFor="closing-moderator">
                  {t('features.events.agenda.closingModerator')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="time" id="closing-time" />
                <Label htmlFor="closing-time">{t('features.events.agenda.closingTime')}</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Duration (only when time-based) */}
          {closingType === 'time' && (
            <div className="space-y-2">
              <Label>{t('features.events.agenda.closingDuration')}</Label>
              <Input
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
              <Label>{t('features.events.agenda.maxVotes')}</Label>
              <Input
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
              <Label>{t('features.events.agenda.choices')}</Label>
              <div className="space-y-2">
                {localChoices.map(choice => (
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
                  <Input
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
      </DialogContent>
    </Dialog>
  );
}

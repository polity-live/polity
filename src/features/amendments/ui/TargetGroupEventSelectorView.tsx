'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import {
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/features/shared/ui/ui/tabs';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import type {
  AmendmentNetworkGroup,
  PathWithEventSegment,
} from '@/features/amendments/logic/amendmentPathHelpers';
import { CalendarClock, GitBranch, Target, User, Workflow } from 'lucide-react';
import { UserNetworkFlow } from '@/features/network/ui/UserNetworkFlow';
import { GroupNetworkFlow } from '@/features/network/ui/GroupNetworkFlow';
import {
  translate as translateText,
  useTranslation,
} from '@/features/shared/hooks/use-translation';
import {
  collectAppTutorialFixtureTextAliases,
  getAppTutorialFixtureTextVariants,
  resolveAppTutorialFixtureText,
  resolveAppTutorialFixtureValue,
} from '@/features/app-tutorial/fixture-copy';
import type { AppTutorialLanguage } from '@/features/app-tutorial/catalog';
import { richTextToPlainText } from '@/features/shared/logic/richText';

function formatEventWindowLabel(timestamp: number | null | undefined, language: string) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPathOptionLabel(
  pathOption: { groupIds: string[] },
  groups: AmendmentNetworkGroup[]
) {
  const groupsById = new Map(groups.map(group => [group.id, group]));
  return pathOption.groupIds.map(groupId => groupsById.get(groupId)?.name ?? groupId).join(' -> ');
}

function tutorialGroupDisplayName(
  group: AmendmentNetworkGroup | null | undefined,
  language: AppTutorialLanguage
): string | null {
  if (!group) return null;
  return (
    resolveAppTutorialFixtureText(group.name, {
      tutorialRunId: group.tutorial_run_id,
      language,
    }) ?? null
  );
}

function toLocalizedGroupTypeaheadItems(
  groups: AmendmentNetworkGroup[],
  language: AppTutorialLanguage,
  groupFallback: string
): TypeaheadItem[] {
  return toTypeaheadItems(
    groups,
    'group',
    group => tutorialGroupDisplayName(group, language) || groupFallback,
    group => {
      const description = richTextToPlainText(
        resolveAppTutorialFixtureValue(group.description, {
          tutorialRunId: group.tutorial_run_id,
          language,
        })
      );
      return description ? description.substring(0, 60) : undefined;
    },
    undefined,
    group => `/group/${group.id}`
  ).map((item, index) => ({
    ...item,
    keywords: [
      ...(item.keywords ?? []),
      ...getAppTutorialFixtureTextVariants(groups[index]?.name, {
        tutorialRunId: groups[index]?.tutorial_run_id,
      }),
      ...(groups[index]?.tutorial_run_id
        ? collectAppTutorialFixtureTextAliases(richTextToPlainText(groups[index]?.description))
        : []),
    ],
  }));
}

export interface TargetGroupEventSelectorViewProps {
  activeSourceGroups: AmendmentNetworkGroup[];
  allWorkflows: any[];
  availableHierarchyPaths: any[];
  availableTargetGroups: AmendmentNetworkGroup[];
  collaborators: any[];
  disablePortal: boolean;
  getUpcomingEventsForGroup: (
    groupId: string,
    segment?: Pick<PathWithEventSegment, 'groupId' | 'requiredAfter' | 'requiredBefore'> | null
  ) => any[];
  handleSourceGroupSelection: (item: TypeaheadItem | null) => void;
  handleStartGraphGroupClick: (groupId: string) => void;
  handleTargetGraphGroupClick: (groupId: string) => void;
  layoutScope: string;
  lockTargetSelection?: boolean;
  networkGroups: AmendmentNetworkGroup[];
  onHierarchyPathValueChange: (value: string) => void;
  onPathModeValueChange: (value: string) => void;
  onPathSegmentEventChange: (segmentKey: string, item: TypeaheadItem | null) => void;
  onSelectedUserChange: (item: TypeaheadItem | null) => void;
  onTargetEventChange: (item: TypeaheadItem | null) => void;
  onTargetGroupChange: (item: TypeaheadItem | null) => void;
  onWorkflowItemChange: (item: TypeaheadItem | null) => void;
  pathMode: 'hierarchy' | 'workflow';
  pathValidationError: string | null;
  pathWithEvents: PathWithEventSegment[];
  reachableWorkflows: any[];
  selectedGroup: { id: string; data: AmendmentNetworkGroup } | null;
  selectedHierarchyPathId: string;
  selectedEvent: { id: string; data: any } | null;
  selectedSourceGroup: { id: string; data: AmendmentNetworkGroup } | null;
  selectedUserId: string;
  selectedWorkflowFinalGroup: AmendmentNetworkGroup | null;
  selectedWorkflow?: {
    id?: string;
    name?: string | null;
    group?: { name?: string | null } | null;
  } | null;
  selectedWorkflowIdState: string;
  selectedWorkflowStartGroup: AmendmentNetworkGroup | null;
  targetEventItems: TypeaheadItem[];
  targetPathSegment: PathWithEventSegment | null;
  upcomingEvents: any[];
}

export function TargetGroupEventSelectorView({
  activeSourceGroups,
  allWorkflows,
  availableHierarchyPaths,
  availableTargetGroups,
  collaborators,
  disablePortal,
  getUpcomingEventsForGroup,
  handleSourceGroupSelection,
  handleStartGraphGroupClick,
  handleTargetGraphGroupClick,
  layoutScope,
  lockTargetSelection = false,
  networkGroups,
  onHierarchyPathValueChange,
  onPathModeValueChange,
  onPathSegmentEventChange,
  onSelectedUserChange,
  onTargetEventChange,
  onTargetGroupChange,
  onWorkflowItemChange,
  pathMode,
  pathValidationError,
  pathWithEvents,
  reachableWorkflows,
  selectedGroup,
  selectedHierarchyPathId,
  selectedEvent,
  selectedSourceGroup,
  selectedUserId,
  selectedWorkflowFinalGroup,
  selectedWorkflow,
  selectedWorkflowIdState,
  selectedWorkflowStartGroup,
  targetEventItems,
  targetPathSegment,
  upcomingEvents,
}: TargetGroupEventSelectorViewProps) {
  const { language, t } = useTranslation();
  const isInitialAmendmentProcess = layoutScope === 'amendment-process-start';
  const displayNetworkGroups = networkGroups.map(group =>
    resolveAppTutorialFixtureValue(group, {
      tutorialRunId: group.tutorial_run_id,
      language,
    })
  );
  const displayPathWithEvents = pathWithEvents.map(segment => {
    const owningGroup = networkGroups.find(group => group.id === segment.groupId);
    return resolveAppTutorialFixtureValue(segment, {
      tutorialRunId: owningGroup?.tutorial_run_id,
      language,
    });
  });

  return (
    <div className="space-y-4">
      {collaborators.length > 0 && (
        <div className="flex items-center gap-3">
          <User className="text-muted-foreground h-4 w-4" />
          <div className="flex-1">
            <TypeaheadSearch
              items={toTypeaheadItems(
                collaborators,
                'user',
                collaborator => collaborator.name || 'User',
                collaborator => collaborator.email,
                collaborator => collaborator.avatar,
                collaborator => `/user/${collaborator.id}`
              )}
              value={selectedUserId}
              onChange={onSelectedUserChange}
              placeholder={translateText(
                'generated.inline.0176_netzwerk_einer_person_auswaehlen_3ec337aa'
              )}
              label={translateText('generated.inline.0177_netzwerk_9b8cf3f3')}
              disablePortal={disablePortal}
            />
          </div>
        </div>
      )}

      <div
        className="space-y-2"
        data-tutorial-anchor={
          isInitialAmendmentProcess ? 'tutorial-process-start-group' : undefined
        }
      >
        <FormControlLabel>
          {translateText('generated.inline.0178_startgruppe_27591dc9')}
        </FormControlLabel>
        {activeSourceGroups.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {translateText(
              'generated.inline.0179_keine_aktive_mitgliedschaft_mit_moeglichem_am_3dc842fc'
            )}
          </p>
        ) : (
          <TypeaheadSearch
            items={toLocalizedGroupTypeaheadItems(
              activeSourceGroups,
              language,
              t('features.amendments.process.groupFallback')
            )}
            value={selectedSourceGroup?.id || ''}
            onChange={handleSourceGroupSelection}
            placeholder={translateText('generated.inline.0180_startgruppe_auswaehlen_2ffb380f')}
            disablePortal={disablePortal}
          />
        )}
      </div>

      {lockTargetSelection ? (
        <div className="border-border bg-muted/40 rounded-md border px-3 py-2 text-sm">
          <p className="font-medium">
            {pathMode === 'workflow'
              ? translateText('features.amendments.process.fixedWorkflow', 'Fixer Workflow')
              : translateText('features.amendments.process.fixedTargetGroup', 'Fixe Zielgruppe')}
          </p>
          <p className="text-muted-foreground mt-1">
            {pathMode === 'workflow'
              ? (selectedWorkflow?.name ??
                tutorialGroupDisplayName(selectedWorkflowFinalGroup, language) ??
                translateText('generated.inline.0028_unbekannt_d0b00a9f'))
              : (tutorialGroupDisplayName(selectedGroup?.data, language) ??
                tutorialGroupDisplayName(selectedWorkflowFinalGroup, language) ??
                translateText('generated.inline.0028_unbekannt_d0b00a9f'))}
          </p>
        </div>
      ) : allWorkflows.length > 0 ? (
        <Tabs value={pathMode} onValueChange={onPathModeValueChange}>
          <TabsList className="w-full">
            <TabsTrigger
              data-action-id="amendments.target-path.select.hierarchy"
              value="hierarchy"
              className="flex-1"
            >
              <GitBranch className="mr-2 h-4 w-4" />
              {translateText('generated.inline.0181_hierarchie_b73f9b95')}
            </TabsTrigger>
            <TabsTrigger
              data-action-id="amendments.target-path.select.workflow"
              value="workflow"
              className="flex-1"
            >
              <Workflow className="mr-2 h-4 w-4" />
              {translateText('generated.inline.0182_workflow_d7a48414')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hierarchy" className="space-y-4">
            <div
              className="space-y-2"
              data-tutorial-anchor={
                isInitialAmendmentProcess ? 'tutorial-process-target-group' : undefined
              }
            >
              <FormControlLabel>
                {translateText('generated.inline.0183_zielgruppe_10f54053')}
              </FormControlLabel>
              {availableTargetGroups.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {translateText(
                    'generated.inline.0184_fuer_diese_startgruppe_gibt_es_keine_rekursiv_5eba3922'
                  )}
                </p>
              ) : (
                <TypeaheadSearch
                  items={toLocalizedGroupTypeaheadItems(
                    availableTargetGroups,
                    language,
                    t('features.amendments.process.groupFallback')
                  )}
                  value={selectedGroup?.id || ''}
                  onChange={onTargetGroupChange}
                  placeholder={translateText('generated.inline.0185_zielgruppe_suchen_aa7a77c8')}
                  disablePortal={disablePortal}
                />
              )}
            </div>

            {selectedSourceGroup && selectedGroup && availableHierarchyPaths.length > 1 ? (
              <div className="space-y-2">
                <FormControlLabel>
                  {translateText('generated.inline.0186_route_4999528e')}
                </FormControlLabel>
                <FormControlSelect
                  data-action-id="amendments.target-path.select.hierarchy-path"
                  value={selectedHierarchyPathId}
                  onValueChange={onHierarchyPathValueChange}
                >
                  <FormControlSelectTrigger data-action-id="amendments.target-path.select.hierarchy-path">
                    <FormControlSelectValue
                      placeholder={translateText('generated.inline.0187_pfad_auswaehlen_42ca323f')}
                    />
                  </FormControlSelectTrigger>
                  <FormControlSelectContent>
                    {availableHierarchyPaths.map(pathOption => (
                      <FormControlSelectItem
                        data-action-id="amendments.target-path.select.hierarchy-path-option"
                        key={pathOption.id}
                        value={pathOption.id}
                      >
                        {formatPathOptionLabel(pathOption, displayNetworkGroups)}
                      </FormControlSelectItem>
                    ))}
                  </FormControlSelectContent>
                </FormControlSelect>
                <p className="text-muted-foreground text-xs">
                  {translateText(
                    'generated.inline.0188_mehrere_gueltige_amendment_pfade_gefunden_hie_635b9345'
                  )}
                </p>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="workflow" className="space-y-4">
            <div className="space-y-2">
              <FormControlLabel>
                {translateText('generated.inline.0189_ziel_workflow_f6a9c843')}
              </FormControlLabel>
              <TypeaheadSearch
                items={toTypeaheadItems(
                  reachableWorkflows,
                  'group',
                  workflow => workflow.name || 'Workflow',
                  workflow => (workflow.group?.name ? `Gruppe: ${workflow.group.name}` : undefined),
                  undefined,
                  workflow => (workflow.group_id ? `/group/${workflow.group_id}` : undefined)
                )}
                value={selectedWorkflowIdState}
                onChange={onWorkflowItemChange}
                placeholder={translateText('generated.inline.0190_workflow_auswaehlen_633186d5')}
                disablePortal={disablePortal}
              />
            </div>

            {selectedWorkflowIdState && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FormControlLabel>
                    {translateText('generated.inline.0191_workflow_start_24e8baa4')}
                  </FormControlLabel>
                  <div className="bg-muted/40 rounded-md border px-3 py-2 text-sm font-medium">
                    {tutorialGroupDisplayName(selectedWorkflowStartGroup, language) ??
                      translateText('generated.inline.0028_unbekannt_d0b00a9f')}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {translateText(
                      'generated.inline.0192_die_quellgruppe_erreicht_diesen_startpunkt_zu_0c954787'
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  <FormControlLabel>
                    {translateText('generated.inline.0193_abgeleitete_zielgruppe_28e1d067')}
                  </FormControlLabel>
                  <div className="bg-muted/40 rounded-md border px-3 py-2 text-sm font-medium">
                    {tutorialGroupDisplayName(selectedWorkflowFinalGroup, language) ??
                      translateText('generated.inline.0028_unbekannt_d0b00a9f')}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {translateText(
                      'generated.inline.0194_im_workflow_modus_wird_die_finale_zielgruppe__420dcffc'
                    )}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <div
          className="space-y-2"
          data-tutorial-anchor={
            isInitialAmendmentProcess ? 'tutorial-process-target-group' : undefined
          }
        >
          <FormControlLabel>
            {translateText('generated.inline.0183_zielgruppe_10f54053')}
          </FormControlLabel>
          {availableTargetGroups.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {translateText(
                'generated.inline.0184_fuer_diese_startgruppe_gibt_es_keine_rekursiv_5eba3922'
              )}
            </p>
          ) : (
            <TypeaheadSearch
              items={toLocalizedGroupTypeaheadItems(
                availableTargetGroups,
                language,
                t('features.amendments.process.groupFallback')
              )}
              value={selectedGroup?.id || ''}
              onChange={onTargetGroupChange}
              placeholder={translateText('generated.inline.0185_zielgruppe_suchen_aa7a77c8')}
              disablePortal={disablePortal}
            />
          )}
        </div>
      )}

      <div className="space-y-2">
        <FormControlLabel>
          {selectedSourceGroup
            ? translateText('generated.inline.0029_netzwerk_der_startgruppe_e8e9bbf1')
            : translateText('generated.inline.0030_startgruppen_netzwerk_83d1c873')}
        </FormControlLabel>
        <div className="h-[28rem] min-h-[28rem] overflow-hidden rounded-md border">
          {selectedSourceGroup ? (
            <GroupNetworkFlow
              groupId={selectedSourceGroup.id}
              filterRight="amendmentRight"
              title={translateText('generated.inline.0195_zielgruppen_netzwerk_d91c9750')}
              description={t('features.amendments.process.networkTargetDescription', {
                group:
                  tutorialGroupDisplayName(selectedSourceGroup.data, language) ??
                  t('features.amendments.process.startGroupFallback'),
              })}
              onGroupClick={groupId => handleTargetGraphGroupClick(groupId)}
              showGroupDialogOnClick={false}
              showWorkflowView={false}
              layoutScopeKey={`amendment-selector:${layoutScope}:group:${selectedSourceGroup.id}`}
            />
          ) : (
            <UserNetworkFlow
              userId={selectedUserId}
              filterRight="amendmentRight"
              title={translateText('generated.inline.0196_startgruppen_netzwerk_83d1c873')}
              description={translateText(
                'generated.inline.0197_waehle_eine_deiner_aktiven_startgruppen_aus_d_058cc520'
              )}
              onGroupClick={groupId => handleStartGraphGroupClick(groupId)}
              showGroupDialogOnClick={false}
              layoutScopeKey={`amendment-selector:${layoutScope}:user:${selectedUserId}`}
            />
          )}
        </div>
      </div>

      {selectedGroup && (
        <div className="space-y-2">
          <FormControlLabel>
            {translateText('generated.inline.0198_ziel_event_8f4df57f')}
          </FormControlLabel>
          {upcomingEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {translateText(
                'generated.inline.0199_fuer_die_zielgruppe_gibt_es_noch_kein_passend_f6bd2a81'
              )}
            </p>
          ) : (
            <TypeaheadSearch
              items={targetEventItems}
              value={selectedEvent?.id || ''}
              onChange={onTargetEventChange}
              placeholder={translateText('generated.inline.0200_event_suchen_389f187f')}
              disablePortal={disablePortal}
            />
          )}
        </div>
      )}

      {pathWithEvents.length > 0 && (
        <div
          className="border-border bg-muted/30 space-y-3 rounded-md border p-3"
          data-tutorial-anchor={
            isInitialAmendmentProcess ? 'tutorial-process-path-review' : undefined
          }
        >
          <div className="flex items-center gap-2">
            <Target className="text-muted-foreground h-4 w-4" />
            <FormControlLabel className="text-sm">
              {translateText('generated.inline.0201_prozesspfad_a9e34361')}
            </FormControlLabel>
          </div>

          <div className="space-y-3">
            {displayPathWithEvents.map((segment, index) => {
              const segmentEvents =
                segment.segmentKey === targetPathSegment?.segmentKey
                  ? upcomingEvents
                  : getUpcomingEventsForGroup(segment.groupId, segment);

              return (
                <div
                  key={segment.segmentKey}
                  className="border-border bg-background rounded-md border p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{segment.groupName}</p>
                      {segment.stepLabel ? (
                        <p className="text-muted-foreground text-xs">{segment.stepLabel}</p>
                      ) : null}
                      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                        {segment.requiredAfter ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {translateText('generated.inline.0202_nicht_vor_96c35f3c')}
                            {formatEventWindowLabel(segment.requiredAfter, language)}
                          </span>
                        ) : null}
                        {segment.requiredBefore ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {translateText('generated.inline.0203_nicht_nach_e88cbaab')}
                            {formatEventWindowLabel(segment.requiredBefore, language)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <BadgeControl
                      variant={segment.eventId ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {translateText('generated.inline.0204_schritt_cc71ba9d')}
                      {index + 1}
                    </BadgeControl>
                  </div>

                  {segmentEvents.length > 0 ? (
                    <TypeaheadSearch
                      items={toTypeaheadItems(
                        segmentEvents,
                        'event',
                        event => event.title || 'Event',
                        event =>
                          formatEventWindowLabel(event.start_date, language) ??
                          t('features.amendments.process.noDate'),
                        undefined,
                        event => `/event/${event.id}`
                      )}
                      value={segment.eventId ?? undefined}
                      onChange={(item: TypeaheadItem | null) =>
                        onPathSegmentEventChange(segment.segmentKey, item)
                      }
                      placeholder={translateText(
                        'generated.inline.0205_event_fuer_diesen_schritt_auswaehlen_d72eb838'
                      )}
                      disablePortal={disablePortal}
                    />
                  ) : (
                    <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                      {translateText(
                        'generated.inline.0206_kein_passendes_event_gefunden_fuer_diesen_sch_36c2ce7b'
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {pathValidationError && <p className="text-destructive text-xs">{pathValidationError}</p>}
        </div>
      )}
    </div>
  );
}

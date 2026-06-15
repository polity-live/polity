'use client';

import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Map,
  MapPin,
  Search,
  SkipForward,
  Users,
  X,
} from 'lucide-react';

import { featureThemeClassName } from '@/features/shared/theme';
import { choiceSelect } from '@/features/shared/motion';
import { FormControlInput } from '@/features/shared/ui/form';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { cn } from '@/features/shared/utils/utils.ts';
import type { Group } from '../hooks/useOnboarding.ts';
import { OnboardingGroupMap } from './OnboardingGroupMap.tsx';

export interface GroupSearchStepViewProps {
  selectedGroups: Group[];
  selectedGroupIds: Set<string>;
  activeGroupId: string | null;
  activeGroup: Group | null;
  hasSelectedGroups: boolean;
  mappableGroups: Group[];
  unmappableGroupCount: number;
  onClearSelectedGroups: () => void;
  onNext: () => void;
  onBack: () => void;
  isLoading?: boolean;
  t: any;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  groupsLoading: boolean;
  filteredGroups: Group[];
  handleSelectGroup: (group: Group) => void;
  handleActivateGroup: (groupId: string | null) => void;
  handleSkip: () => void;
}

export function GroupSearchStepView({
  selectedGroups,
  selectedGroupIds,
  activeGroupId,
  activeGroup,
  hasSelectedGroups,
  mappableGroups,
  unmappableGroupCount,
  onClearSelectedGroups,
  onNext,
  onBack,
  isLoading,
  t,
  searchTerm,
  setSearchTerm,
  groupsLoading,
  filteredGroups,
  handleSelectGroup,
  handleActivateGroup,
  handleSkip,
}: GroupSearchStepViewProps) {
  return (
    <div className="space-y-5 lg:space-y-6">
      <div>
        <div className="mb-3 flex lg:mb-4">
          <div className={featureThemeClassName('authGroupSearchStepSuccessGradientSurface')}>
            <Users className={featureThemeClassName('authGroupSearchStepContrastIcon')} />
          </div>
        </div>
        <h2 className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
          {t('onboarding.groupStep.title')}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl leading-7 lg:mt-3">
          {t('onboarding.groupStep.description')}
        </p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <FormControlInput
            placeholder={t('onboarding.groupStep.searchPlaceholder')}
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            className="h-11 pl-10"
            disabled={isLoading}
          />
        </div>

        <div className="bg-card rounded-lg border p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t('onboarding.groupStep.selectionTitle')}</p>
              <p className="text-muted-foreground text-xs">
                {hasSelectedGroups
                  ? t('onboarding.groupStep.selectedCount', { count: selectedGroups.length })
                  : t('onboarding.groupStep.emptySelectionDescription')}
              </p>
            </div>

            {hasSelectedGroups && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearSelectedGroups}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
                {t('onboarding.groupStep.clearSelection')}
              </Button>
            )}
          </div>

          {hasSelectedGroups && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {selectedGroups.map(group => (
                <div
                  key={group.id}
                  className={cn(
                    'bg-primary/10 text-primary flex max-w-[14rem] flex-none items-center rounded-md text-xs font-semibold',
                    activeGroupId === group.id && 'ring-primary/30 ring-2'
                  )}
                >
                  <button
                    type="button"
                    className="hover:bg-primary/15 min-w-0 rounded-l-md px-3 py-1.5 transition-colors"
                    onClick={() => handleActivateGroup(group.id)}
                  >
                    <span className="block truncate">{group.name}</span>
                  </button>
                  <button
                    type="button"
                    className="hover:bg-primary/15 rounded-r-md px-2 py-1.5 transition-colors"
                    aria-label={`${t('onboarding.groupStep.clearSelection')} ${group.name}`}
                    onClick={() => handleSelectGroup(group)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]">
        <div className="bg-card overflow-hidden rounded-lg border shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{t('onboarding.groupStep.matchesTitle')}</p>
              <p className="text-muted-foreground text-xs">
                {t('onboarding.groupStep.matchesDescription')}
              </p>
            </div>
            <BadgeControl variant="outline">{filteredGroups.length}</BadgeControl>
          </div>

          <div className="max-h-[24rem] space-y-2 overflow-y-auto p-2 lg:max-h-[31rem]">
            {groupsLoading ? (
              <div className="text-muted-foreground py-10 text-center">
                <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2" />
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="font-medium">{t('onboarding.groupStep.noResults')}</p>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {t('onboarding.groupStep.noResultsHint')}
                </p>
              </div>
            ) : (
              filteredGroups.map(group => {
                const isSelected = selectedGroupIds.has(group.id);
                const isActive = activeGroupId === group.id;

                return (
                  <motion.button
                    key={group.id}
                    type="button"
                    variants={choiceSelect}
                    initial="rest"
                    animate={isSelected ? 'selected' : 'rest'}
                    whileTap="tap"
                    className={cn(
                      'hover:border-primary/40 hover:bg-accent/40 w-full cursor-pointer rounded-lg border p-4 text-left transition-colors',
                      isSelected && 'border-primary bg-primary/5 ring-primary/20 ring-2',
                      isActive && !isSelected && 'border-primary/50 bg-primary/5'
                    )}
                    onClick={() => handleSelectGroup(group)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-semibold">{group.name}</p>
                        {group.description && (
                          <p className="text-muted-foreground line-clamp-2 text-sm leading-6">
                            {group.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-none items-center gap-2">
                        {isSelected && (
                          <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-md">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                        <BadgeControl variant="outline" className="flex-shrink-0">
                          <Users className="mr-1 h-3 w-3" />
                          {group.member_count}
                        </BadgeControl>
                      </div>
                    </div>
                    {group.location && (
                      <div className="text-muted-foreground mt-3 flex items-center gap-1 text-xs">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{group.location}</span>
                      </div>
                    )}
                    {group.matchingInterestTags && group.matchingInterestTags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <BadgeControl variant="secondary" className="rounded-md">
                          {t('onboarding.groupStep.interestMatch')}
                        </BadgeControl>
                        {group.matchingInterestTags.slice(0, 3).map(tag => (
                          <BadgeControl key={tag} variant="outline" className="rounded-md">
                            #{tag}
                          </BadgeControl>
                        ))}
                      </div>
                    )}
                  </motion.button>
                );
              })
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-card rounded-lg border p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t('onboarding.groupStep.mapTitle')}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  {t('onboarding.groupStep.mapDescription')}
                </p>
              </div>
              <div className="bg-primary/10 text-primary flex h-9 w-9 flex-none items-center justify-center rounded-md">
                <Map className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <BadgeControl variant="outline">
                {t('onboarding.groupStep.mappableCount', { count: mappableGroups.length })}
              </BadgeControl>
              {unmappableGroupCount > 0 && (
                <BadgeControl variant="secondary">
                  {t('onboarding.groupStep.unmappedCount', { count: unmappableGroupCount })}
                </BadgeControl>
              )}
            </div>
          </div>

          <OnboardingGroupMap
            groups={mappableGroups}
            activeGroupId={activeGroupId}
            selectedGroupIds={selectedGroupIds}
            onActiveGroupChange={handleActivateGroup}
          />

          <div className="bg-card rounded-lg border p-4 shadow-sm">
            <p className="text-sm font-semibold">{t('onboarding.groupStep.activeTitle')}</p>
            {activeGroup ? (
              <div className="mt-3 space-y-2">
                <p className="font-semibold">{activeGroup.name}</p>
                {activeGroup.location && (
                  <p className="text-muted-foreground flex items-center gap-1 text-sm">
                    <MapPin className="h-3.5 w-3.5" />
                    {activeGroup.location}
                  </p>
                )}
                <p className="text-muted-foreground text-sm leading-6">
                  {selectedGroupIds.has(activeGroup.id)
                    ? t('onboarding.groupStep.activeSelectedDescription')
                    : t('onboarding.groupStep.activeDescription')}
                </p>
                {activeGroup.matchingInterestTags &&
                  activeGroup.matchingInterestTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {activeGroup.matchingInterestTags.slice(0, 3).map(tag => (
                        <BadgeControl key={tag} variant="outline">
                          #{tag}
                        </BadgeControl>
                      ))}
                    </div>
                  )}
              </div>
            ) : (
              <p className="text-muted-foreground mt-3 text-sm leading-6">
                {t('onboarding.groupStep.emptyActiveDescription')}
              </p>
            )}
          </div>
        </aside>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          <ArrowLeft className="h-4 w-4" />
          {t('common.goBack')}
        </Button>

        <div className="flex flex-col gap-2 sm:flex-row">
          {!hasSelectedGroups && (
            <Button variant="secondary" onClick={handleSkip} disabled={isLoading}>
              <SkipForward className="h-4 w-4" />
              {t('onboarding.groupStep.skip')}
            </Button>
          )}
          <Button onClick={hasSelectedGroups ? onNext : handleSkip} disabled={isLoading}>
            {hasSelectedGroups
              ? t('onboarding.groupStep.continue')
              : t('onboarding.groupStep.continueWithoutGroup')}
            {hasSelectedGroups && (
              <BadgeControl variant="secondary" className="ml-1">
                {selectedGroups.length}
              </BadgeControl>
            )}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

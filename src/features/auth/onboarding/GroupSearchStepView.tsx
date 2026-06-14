'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { FormControlInput } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card.tsx';
import { Search, Users, MapPin, ArrowRight, ArrowLeft, Check, SkipForward } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils.ts';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import { richTextToPlainText } from '@/features/shared/logic/richText';
export interface GroupSearchStepViewProps {
  selectedGroup: any;
  onSelectGroup: any;
  onNext: any;
  onBack: any;
  isLoading: any;
  t: any;
  searchTerm: any;
  setSearchTerm: any;
  groupsData: any[];
  groupsLoading: any;
  filteredGroups: any[];
  handleSelectGroup: any;
  handleSkip: any;
}

export function GroupSearchStepView({
  selectedGroup,
  onNext,
  onBack,
  isLoading,
  t,
  searchTerm,
  setSearchTerm,
  groupsLoading,
  filteredGroups,
  handleSelectGroup,
  handleSkip,
}: GroupSearchStepViewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className={featureThemeClassName('authGroupSearchStepSuccessGradientSurface')}>
            <Users className={featureThemeClassName('authGroupSearchStepContrastIcon')} />
          </div>
        </div>
        <h2 className="text-2xl font-bold">{t('onboarding.groupStep.title')}</h2>
        <p className="text-muted-foreground mt-2">{t('onboarding.groupStep.description')}</p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <FormControlInput
          placeholder={t('onboarding.groupStep.searchPlaceholder')}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10"
          disabled={isLoading}
        />
      </div>

      {/* Group Cards */}
      <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
        {groupsLoading ? (
          <div className="text-muted-foreground py-8 text-center">
            <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            {t('onboarding.groupStep.noResults')}
          </div>
        ) : (
          filteredGroups.map((group: any) => (
            <Card
              key={group.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                selectedGroup?.id === group.id &&
                  featureThemeClassName('authGroupSearchStepSuccessNeutralBorder')
              )}
              onClick={() => handleSelectGroup(group)}
            >
              {(() => {
                const location = formatLocation(group);
                const description = richTextToPlainText(group.description);

                return (
                  <>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{group.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          {selectedGroup?.id === group.id && (
                            <div
                              className={featureThemeClassName('authGroupSearchStepSuccessPanel')}
                            >
                              <Check
                                className={featureThemeClassName(
                                  'authGroupSearchStepSuccessContrastIcon'
                                )}
                              />
                            </div>
                          )}
                          <BadgeControl variant="outline" className="flex-shrink-0">
                            <Users className="mr-1 h-3 w-3" />
                            {group.member_count || 0}
                          </BadgeControl>
                        </div>
                      </div>
                      {description && (
                        <CardDescription className="line-clamp-2 text-xs">
                          {description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    {location && (
                      <CardContent className="pt-0">
                        <div className="text-muted-foreground flex items-center gap-1 text-xs">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{location}</span>
                        </div>
                      </CardContent>
                    )}
                  </>
                );
              })()}
            </Card>
          ))
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} disabled={isLoading} className="flex-1">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.goBack')}
        </Button>

        {selectedGroup ? (
          <Button onClick={onNext} disabled={isLoading} className="flex-1">
            {t('onboarding.groupStep.continue')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button variant="secondary" onClick={handleSkip} disabled={isLoading} className="flex-1">
            <SkipForward className="mr-2 h-4 w-4" />
            {t('onboarding.groupStep.skip')}
          </Button>
        )}
      </div>
    </div>
  );
}

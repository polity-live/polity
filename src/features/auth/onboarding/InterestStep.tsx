'use client';

import { ArrowLeft, ArrowRight, Hash, RotateCcw, Sparkles } from 'lucide-react';

import { featureThemeClassName } from '@/features/shared/theme';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { cn } from '@/features/shared/utils/utils.ts';

interface InterestStepProps {
  selectedInterestTags: string[];
  suggestions: string[];
  onSelectedInterestTagsChange: (tags: string[]) => void;
  onToggleInterestTag: (tag: string) => void;
  onClearInterestTags: () => void;
  onNext: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

function getSuggestedTags(rawSuggestions: string, canonicalSuggestions: string[]) {
  const defaultTags = rawSuggestions
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
  const seen = new Set<string>();

  return [...defaultTags, ...canonicalSuggestions]
    .filter(tag => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 14);
}

export function InterestStep({
  selectedInterestTags,
  suggestions,
  onSelectedInterestTagsChange,
  onToggleInterestTag,
  onClearInterestTags,
  onNext,
  onBack,
  isLoading,
}: InterestStepProps) {
  const { t } = useTranslation();
  const suggestedTags = getSuggestedTags(t('onboarding.interestStep.suggestions'), suggestions);
  const selectedTagKeys = new Set(selectedInterestTags.map(tag => tag.toLowerCase()));
  const selectionCountLabel =
    selectedInterestTags.length === 1
      ? t('onboarding.interestStep.selectedCountOne')
      : t('onboarding.interestStep.selectedCount', { count: selectedInterestTags.length });

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex lg:mb-4">
          <div className={featureThemeClassName('authGroupSearchStepSuccessGradientSurface')}>
            <Hash className={featureThemeClassName('authGroupSearchStepContrastIcon')} />
          </div>
        </div>
        <h2 className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
          {t('onboarding.interestStep.title')}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl leading-7 lg:mt-3">
          {t('onboarding.interestStep.description')}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{t('onboarding.interestStep.pickTitle')}</p>
            <p className="text-muted-foreground text-xs">
              {selectedInterestTags.length > 0
                ? selectionCountLabel
                : t('onboarding.interestStep.emptySelection')}
            </p>
          </div>

          {selectedInterestTags.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearInterestTags}
              disabled={isLoading}
            >
              <RotateCcw className="h-4 w-4" />
              {t('onboarding.interestStep.clear')}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {suggestedTags.map(tag => {
            const isSelected = selectedTagKeys.has(tag.toLowerCase());

            return (
              <button
                key={tag}
                type="button"
                disabled={isLoading}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent/40'
                )}
                onClick={() => onToggleInterestTag(tag)}
              >
                #{tag}
              </button>
            );
          })}
        </div>

        <HashtagEditor
          value={selectedInterestTags}
          onChange={onSelectedInterestTagsChange}
          label={t('onboarding.interestStep.customLabel')}
          placeholder={t('onboarding.interestStep.customPlaceholder')}
          maxTags={8}
          suggestions={suggestedTags}
        />
      </div>

      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="flex gap-3">
          <div className="bg-primary/10 text-primary flex h-9 w-9 flex-none items-center justify-center rounded-md">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{t('onboarding.interestStep.previewTitle')}</p>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {t('onboarding.interestStep.previewDescription')}
            </p>
            {selectedInterestTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedInterestTags.slice(0, 4).map(tag => (
                  <BadgeControl key={tag} variant="outline">
                    #{tag}
                  </BadgeControl>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          <ArrowLeft className="h-4 w-4" />
          {t('common.goBack')}
        </Button>

        <Button onClick={onNext} disabled={isLoading}>
          {selectedInterestTags.length > 0
            ? t('onboarding.interestStep.continue')
            : t('onboarding.interestStep.skip')}
          {selectedInterestTags.length > 0 && (
            <BadgeControl variant="secondary" className="ml-1">
              {selectedInterestTags.length}
            </BadgeControl>
          )}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

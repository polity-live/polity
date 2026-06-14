import { featureThemeClassName } from '@/features/shared/theme';
import type * as React from 'react';
import { ChevronDown, ChevronUp, FileText, AlertCircle, Lightbulb } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';
import type { DecisionSummarySection } from './DecisionSummary';

const SECTION_ICONS: Record<
  DecisionSummarySection['type'],
  React.ComponentType<{ className?: string }>
> = {
  summary: FileText,
  problem: AlertCircle,
  proposal: Lightbulb,
  impact: AlertCircle,
  background: FileText,
};

const SECTION_COLORS: Record<DecisionSummarySection['type'], string> = {
  summary: featureThemeClassName('decisionterminalDecisionSummaryInfoText'),
  problem: featureThemeClassName('decisionterminalDecisionStatusDangerTextAlpha'),
  proposal: featureThemeClassName('decisionterminalDecisionStatusSuccessText'),
  impact: featureThemeClassName('decisionterminalCountdownTimerWarningText'),
  background: featureThemeClassName('decisionterminalDecisionStatusNeutralText'),
};

interface CollapsibleSectionViewProps {
  section: DecisionSummarySection;
  isCollapsed: boolean;
  onToggle: () => void;
  maxContentHeight: number;
  contentRef: React.RefObject<HTMLDivElement | null>;
  needsCollapse: boolean;
}

export function CollapsibleSectionView({
  section,
  isCollapsed,
  onToggle,
  maxContentHeight,
  contentRef,
  needsCollapse,
}: CollapsibleSectionViewProps) {
  const Icon = SECTION_ICONS[section.type];
  const colorClass = SECTION_COLORS[section.type];

  return (
    <div className={featureThemeClassName('decisionterminalDecisionSummaryNeutralBorder')}>
      <Button
        type="button"
        variant="ghost"
        onClick={onToggle}
        className={featureThemeClassName('decisionterminalDecisionSummaryNeutralPanel')}
        aria-expanded={!isCollapsed}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', colorClass)} />
          <span className="text-sm font-medium">{section.title}</span>
        </div>
        {isCollapsed ? (
          <ChevronDown
            className={featureThemeClassName('decisionterminalDecisionSummaryNeutralIcon')}
          />
        ) : (
          <ChevronUp
            className={featureThemeClassName('decisionterminalDecisionSummaryNeutralIcon')}
          />
        )}
      </Button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isCollapsed ? 'max-h-0' : needsCollapse ? 'max-h-[500px]' : 'max-h-[2000px]'
        )}
      >
        <div
          ref={contentRef}
          className={cn(
            featureThemeClassName('decisionterminalDecisionSummaryNeutralText'),
            isCollapsed ? 'opacity-0' : 'opacity-100'
          )}
          style={{
            maxHeight: isCollapsed ? 0 : needsCollapse && isCollapsed ? maxContentHeight : 'none',
            overflow: 'hidden',
          }}
        >
          {section.content}
        </div>
      </div>
    </div>
  );
}

interface DecisionSummaryViewProps {
  sections: DecisionSummarySection[];
  maxContentHeight: number;
  className?: string;
  labels: {
    details: string;
    expandAll: string;
    collapseAll: string;
  };
  collapsedSections: Set<number>;
  onToggleSection: (index: number) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  allCollapsed: boolean;
  allExpanded: boolean;
  renderSection: (section: DecisionSummarySection, index: number) => React.ReactNode;
}

export function DecisionSummaryView({
  sections,
  className,
  labels,
  collapsedSections,
  onToggleSection,
  onExpandAll,
  onCollapseAll,
  allCollapsed,
  allExpanded,
  renderSection,
}: DecisionSummaryViewProps) {
  return (
    <div
      className={cn(
        featureThemeClassName('decisionterminalDecisionSummaryNeutralBorderAlpha'),
        className
      )}
    >
      <div className={featureThemeClassName('decisionterminalDecisionSummaryNeutralSurface')}>
        <span className={featureThemeClassName('decisionterminalDecisionSummaryNeutralTextAlpha')}>
          {labels.details}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExpandAll}
            disabled={allExpanded}
            className="h-6 px-2 text-xs"
          >
            {labels.expandAll}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCollapseAll}
            disabled={allCollapsed}
            className="h-6 px-2 text-xs"
          >
            {labels.collapseAll}
          </Button>
        </div>
      </div>

      <div>
        {sections.map((section, index) => (
          <div key={`${section.type}-${index}`}>
            {renderSection(section, index)}
            <span className="sr-only">
              {collapsedSections.has(index) ? 'collapsed' : 'expanded'}
            </span>
            <button type="button" className="hidden" onClick={() => onToggleSection(index)} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface DecisionSummaryCompactViewProps {
  summary: string;
  className?: string;
  isExpanded: boolean;
  onToggle: () => void;
  labels: {
    showLess: string;
    readMore: string;
  };
}

export function DecisionSummaryCompactView({
  summary,
  className,
  isExpanded,
  onToggle,
  labels,
}: DecisionSummaryCompactViewProps) {
  return (
    <div className={cn('text-sm', className)}>
      <p
        className={cn(
          featureThemeClassName('decisionterminalDecisionSummaryNeutralTextBeta'),
          !isExpanded && 'line-clamp-2'
        )}
      >
        {summary}
      </p>
      {summary.length > 150 && (
        <Button variant="link" size="sm" onClick={onToggle} className="h-auto p-0 text-xs">
          {isExpanded ? labels.showLess : labels.readMore}
        </Button>
      )}
    </div>
  );
}

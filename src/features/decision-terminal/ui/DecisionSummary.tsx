'use client';

import * as React from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  CollapsibleSectionView,
  DecisionSummaryCompactView,
  DecisionSummaryView,
} from './DecisionSummaryView';

export interface DecisionSummarySection {
  type: 'summary' | 'problem' | 'proposal' | 'impact' | 'background';
  title: string;
  content: string;
  isCollapsed?: boolean;
}

export interface DecisionSummaryProps {
  sections: DecisionSummarySection[];
  /** Default collapsed state for all sections */
  defaultCollapsed?: boolean;
  /** Maximum height before showing "read more" */
  maxContentHeight?: number;
  className?: string;
}

interface CollapsibleSectionProps {
  section: DecisionSummarySection;
  isCollapsed: boolean;
  onToggle: () => void;
  maxContentHeight: number;
}

export function CollapsibleSection({
  section,
  isCollapsed,
  onToggle,
  maxContentHeight,
}: CollapsibleSectionProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [needsCollapse, setNeedsCollapse] = React.useState(false);

  React.useEffect(() => {
    if (contentRef.current) {
      setNeedsCollapse(contentRef.current.scrollHeight > maxContentHeight);
    }
  }, [section.content, maxContentHeight]);

  return (
    <CollapsibleSectionView
      section={section}
      isCollapsed={isCollapsed}
      onToggle={onToggle}
      maxContentHeight={maxContentHeight}
      contentRef={contentRef}
      needsCollapse={needsCollapse}
    />
  );
}

/**
 * DecisionSummary - Collapsible sections for decision details
 *
 * Shows summary, problem statement, proposal, impact, and background
 * sections with expand/collapse functionality.
 */
export function DecisionSummary({
  sections,
  defaultCollapsed = false,
  maxContentHeight = 150,
  className,
}: DecisionSummaryProps) {
  const { t } = useTranslation();
  const [collapsedSections, setCollapsedSections] = React.useState<Set<number>>(() => {
    if (defaultCollapsed) {
      return new Set(sections.map((_, i) => i));
    }
    // By default, only first section is expanded
    return new Set(sections.slice(1).map((_, i) => i + 1));
  });

  const toggleSection = React.useCallback((index: number) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const expandAll = React.useCallback(() => {
    setCollapsedSections(new Set());
  }, []);

  const collapseAll = React.useCallback(() => {
    setCollapsedSections(new Set(sections.map((_, i) => i)));
  }, [sections]);

  const allCollapsed = collapsedSections.size === sections.length;
  const allExpanded = collapsedSections.size === 0;

  if (sections.length === 0) {
    return null;
  }

  return (
    <DecisionSummaryView
      sections={sections}
      maxContentHeight={maxContentHeight}
      className={className}
      labels={{
        details: t('features.timeline.terminal.details'),
        expandAll: t('features.timeline.terminal.expandAll'),
        collapseAll: t('features.timeline.terminal.collapseAll'),
      }}
      collapsedSections={collapsedSections}
      onToggleSection={toggleSection}
      onExpandAll={expandAll}
      onCollapseAll={collapseAll}
      allCollapsed={allCollapsed}
      allExpanded={allExpanded}
      renderSection={(section, index) => (
        <CollapsibleSection
          section={section}
          isCollapsed={collapsedSections.has(index)}
          onToggle={() => toggleSection(index)}
          maxContentHeight={maxContentHeight}
        />
      )}
    />
  );
}

/**
 * DecisionSummaryCompact - Single line summary with expand
 */
export function DecisionSummaryCompact({
  summary,
  className,
}: {
  summary: string;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { t } = useTranslation();

  return (
    <DecisionSummaryCompactView
      summary={summary}
      className={className}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      labels={{
        showLess: t('features.timeline.terminal.showLess'),
        readMore: t('features.timeline.terminal.readMore'),
      }}
    />
  );
}

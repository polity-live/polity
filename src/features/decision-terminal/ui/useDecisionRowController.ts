'use client';
import { useState, useEffect, useRef } from 'react';
import { Vote, Award } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { DecisionItem } from './types';
export interface DecisionRowProps {
  decision: DecisionItem;
}
function getElectionBarData(decision: DecisionItem) {
  if (decision.type !== 'election' || !decision.candidates?.length) {
    return null;
  }

  const candidates = decision.candidates
    .map(candidate => ({
      id: candidate.id,
      label: candidate.name,
      value: decision.isIndicationPhase ? candidate.indicationVotes || 0 : candidate.votes || 0,
    }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));

  return {
    totalSelections:
      decision.votedCount ?? candidates.reduce((total, candidate) => total + candidate.value, 0),
    candidates,
  };
}
export function useDecisionRowController({ decision }: DecisionRowProps) {
  const { t } = useTranslation();

  const [isFlashing, setIsFlashing] = useState(false);

  const prevTrendRef = useRef(decision.trend.percentage);

  const electionBarData = getElectionBarData(decision);

  const gridColumnsClass = 'grid-cols-[70px_minmax(0,0.9fr)_120px_92px_104px_170px_72px]';

  // Flash effect when trend changes significantly (> 2%)
  useEffect(() => {
    const change = Math.abs(decision.trend.percentage - prevTrendRef.current);
    if (change >= 2) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 500);
      prevTrendRef.current = decision.trend.percentage;
      return () => clearTimeout(timer);
    }
    prevTrendRef.current = decision.trend.percentage;
  }, [decision.trend.percentage]);

  const Icon = decision.type === 'vote' ? Vote : Award;

  return {
    decision,
    t,
    isFlashing,
    setIsFlashing,
    prevTrendRef,
    electionBarData,
    gridColumnsClass,
    Icon,
  };
}

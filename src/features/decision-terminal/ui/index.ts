// Decision Terminal Components
export { DecisionTerminal, type DecisionTerminalProps } from './DecisionTerminal';
export { DecisionDashboardGrid } from './DecisionDashboardGrid';
export {
  DecisionDashboardGridView,
  type DecisionDashboardGridViewProps,
} from './DecisionDashboardGridView';
export { DecisionDashboardHeader } from './DecisionDashboardHeader';
export { DecisionTerminalView, type DecisionTerminalViewProps } from './DecisionTerminalView';
export { DecisionVoteButton } from './DecisionVoteButton';
export { DecisionVoteDialogController } from './DecisionVoteDialogController';
export { DecisionWidgetContent } from './DecisionWidgetContent';
export { DecisionWidgetFrame } from './DecisionWidgetFrame';
export { TerminalHeader, type TerminalHeaderProps, type TerminalFilter } from './TerminalHeader';
export { DecisionTable, type DecisionTableProps } from './DecisionTable';
export { DecisionRow, type DecisionRowProps } from './DecisionRow';
export { MobileDecisionCard, type MobileDecisionCardProps } from './MobileDecisionCard';
export {
  DecisionSummary,
  DecisionSummaryCompact,
  type DecisionSummaryProps,
  type DecisionSummarySection,
} from './DecisionSummary';
export { FlashRow, FlashCell, FlashIndicator, type FlashRowProps } from './FlashRow';

// Status & Indicators
export {
  DecisionStatusBadge as StatusBadge,
  DecisionStatusDot as StatusDot,
  getDecisionStatusConfig as getStatusConfig,
  type DecisionStatusBadgeProps as StatusBadgeProps,
  type DecisionStatus,
} from '@/features/shared/ui/status';
export {
  TrendIndicator,
  TrendArrow,
  getTrendConfig,
  formatPercentageChange,
  type TrendIndicatorProps,
  type TrendData,
  type TrendDirection,
} from './TrendIndicator';
export { CountdownTimer, EndedAgo, type CountdownTimerProps } from './CountdownTimer';
export {
  DecisionResultBadge as ResultBadge,
  DecisionResultCompact as ResultCompact,
  getDecisionResultConfig as getResultConfig,
  type DecisionResultBadgeProps as ResultBadgeProps,
  type DecisionResultType as ResultType,
} from '@/features/shared/ui/voting';
export {
  VoteProgressBar,
  VoteBarCompact,
  calculateVotePercentages,
  type VoteProgressBarProps,
  type VoteData,
} from './VoteProgressBar';

// Types
export * from './types';

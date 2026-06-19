import type { Visibility } from '@/features/auth/logic/checkEntityAccess';
import type { ElectionMode } from '@/features/elections/logic/electionMode';
import type { VotingPhase } from '@/features/vote-cast/logic/votePhaseHelpers';
import type { TrendData } from './TrendIndicator';
import type { VoteData } from './VoteProgressBar';

/**
 * Type of decision: vote on an amendment or leadership election
 */
export type DecisionType = 'vote' | 'election';

export type DecisionTemporalBucket = 'active' | 'future' | 'past';

export type DecisionLiveDeltaTone = 'success' | 'danger' | 'neutral';

export interface DecisionLiveDelta {
  key: string;
  label: string;
  value: number;
  tone: DecisionLiveDeltaTone;
}

/**
 * Status of a decision for display purposes
 */
export type DecisionDisplayStatus =
  | 'open'
  | 'closing_soon'
  | 'last_hour'
  | 'final_minutes'
  | 'passed'
  | 'failed'
  | 'tied'
  | 'elected';

/**
 * Decision item for the terminal
 */
export interface DecisionItem {
  /** Unique identifier (e.g., V-204, E-88) */
  id: string;

  /** Actual source entity id from election/vote table */
  sourceId: string;

  /** Type of decision */
  type: DecisionType;

  /** Title of the decision */
  title: string;

  /** Body/category (e.g., "Transport", "Finance", "Urban Development") */
  body: string;

  /** When the decision ends/ended */
  endsAt: Date;

  /** When the decision starts/started (from agenda item or creation) */
  startsAt?: Date;

  /** Stable start sort key used by dashboard panels */
  sortStartsAt?: Date;

  /** Stable end sort key used by dashboard panels */
  sortEndsAt?: Date;

  /** Derived temporal bucket for panel routing */
  temporalBucket?: DecisionTemporalBucket;

  /** Active decision means running phase, not closed, and not future-starting */
  isActiveDecision?: boolean;

  /** Future decision means it is visible but not active yet */
  isFutureDecision?: boolean;

  /** Display status */
  status: DecisionDisplayStatus;

  /** Is this a closed decision? */
  isClosed: boolean;

  /** Is this closing soon (< 24 hours)? */
  isClosingSoon: boolean;

  /** Is this opening soon (starts within 24 hours, not yet active)? */
  isOpeningSoon: boolean;

  /** Was this recently closed (within last 24 hours)? */
  isRecentlyClosed: boolean;

  /** Is this urgent (< 1 hour)? */
  isUrgent: boolean;

  /** Visibility tier of this decision */
  visibility: Visibility;

  /** Trend data (support/oppose shift) */
  trend: TrendData;

  /** Vote counts (for votes) */
  votes?: VoteData;

  /** Voter turnout percentage */
  turnout?: number;

  /** Total members eligible to vote */
  totalMembers?: number;

  /** Number of members who voted */
  votedCount?: number;

  /** Winner name (for elections) */
  winnerName?: string;

  /** Support percentage (for closed votes) */
  supportPercentage?: number;

  /** Link to full decision page */
  href: string;

  /** Related event and agenda context for voting */
  eventId?: string;
  agendaItemId?: string;
  voteId?: string;
  electionId?: string;
  phase?: VotingPhase;
  ballotVisibility?: string | null;
  voterId?: string;
  electorId?: string;
  canOpenVoteDialog?: boolean;

  /** Summary of the decision */
  summary?: string;

  /** Problem statement */
  problem?: string;

  /** Proposal details */
  proposal?: string;

  /** Related entity (amendment, group, etc.) */
  entity?: {
    id: string;
    name: string;
    type: string;
    href: string;
  };

  /** Related agenda item (for votes/elections) */
  agendaItem?: {
    id: string;
    name: string;
    href: string;
  };

  // Indication support
  /** Whether this decision is still in indication phase */
  isIndicationPhase?: boolean;

  /** Indication vote data */
  indicationVotes?: VoteData;

  /** Indication support percentage */
  indicationSupportPercentage?: number;

  /** Candidates (for elections) */
  candidates?: {
    id: string;
    name: string;
    avatarUrl?: string;
    votes?: number;
    isWinner?: boolean;
    indicationVotes?: number;
    indicationPercentage?: number;
    actualPercentage?: number;
  }[];

  /** Vote choices (for proposal/amendment votes) */
  choices?: {
    id: string;
    label: string;
  }[];

  /** Election casting config */
  maxVotes?: number;
  electionMode?: ElectionMode | null;
  seatCount?: number | null;

  /** Whether the event-role-only panel filter applies to this item */
  eventRoleFilterApplies?: boolean;

  /** Current user has an accepted event participation with at least one assigned role */
  hasConfirmedEventRole?: boolean;

  /** Transient per-choice/candidate vote deltas for live updates */
  liveDeltas?: DecisionLiveDelta[];
}

/**
 * Configuration for terminal display
 */
export interface TerminalConfig {
  /** Refresh interval in ms */
  refreshInterval: number;

  /** Show sound alerts for urgent items */
  soundAlerts: boolean;

  /** Display density: compact or comfortable */
  density: 'compact' | 'comfortable';

  /** Flash threshold: minimum percentage change to flash */
  flashThreshold: number;
}

export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  refreshInterval: 30000, // 30 seconds
  soundAlerts: false,
  density: 'comfortable',
  flashThreshold: 2, // 2% change triggers flash
};

import type { Sql } from 'postgres';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import type { MutationExpectation, MutationOutcome } from './mutation-metrics';

export interface MutationCaseContext {
  sql: Sql;
  /** Each repetition owns a fresh ID namespace; identity fields must use these actors. */
  id: string;
  ownerID: string;
  outsiderID: string;
  actorID: string;
  actor: string;
}
export interface MutationPreparedCase {
  args: ReadonlyJSONValue | undefined;
  /** Existing public query; called with observer's own authenticated context. */
  observe?: {
    /** Separate observer client; writer identity is needed for actor-filtered queries. */
    actor?: 'owner' | 'writer';
    request: unknown;
    before: (data: unknown) => boolean;
    after: (data: unknown) => boolean;
  };
  /** Existing independent queries needed by the local mutator's real read guards. */
  writerPreloads?: { request: unknown; before: (data: unknown) => boolean }[];
  /** Optional real fixture transition after writer preload, e.g. permission revocation. */
  beforeInvoke?: () => Promise<void>;
  /** A denied-after-preload case must begin with an authorized, replicated writer baseline. */
  requireWriterBefore?: boolean;
  /** Uses independent SQL/explicit expectations, never runs the subject mutator. */
  verify: () => Promise<void>;
  /** Verify settled optimistic view rollback after expected rejection, if applicable. */
  verifyRollback?: (writer: unknown) => Promise<void>;
  restore: () => Promise<void>;
  verifyRestored: () => Promise<void>;
}
export interface MutationCase {
  name: string;
  variant: string;
  actor: string;
  outcome: MutationOutcome;
  error?: string;
  observer: MutationExpectation['observer'];
  /** Reviewed, serializable fixture/oracle specification; contributes to the checksum. */
  specification: ReadonlyJSONValue;
  prepare: (context: MutationCaseContext) => Promise<MutationPreparedCase>;
}
export type MutationCaseFactory = () => MutationCase[];

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createElectionFlowCorrelationId,
  logElectionFlowClient,
  logElectionFlowClientError,
  logElectionFlowServer,
} from '../electionFlowLogging';

describe('electionFlowLogging', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates a flow-scoped correlation id', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('uuid' as never);
    expect(createElectionFlowCorrelationId('delegate')).toBe('delegate:uuid');
  });

  it('logs client and server stages with optional payloads', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logElectionFlowClient('flow-1', 'start');
    logElectionFlowClient('flow-1', 'done', { electionId: 'election-1' });
    logElectionFlowClientError('flow-2', 'failed');
    logElectionFlowClientError('flow-2', 'failed', { reason: 'conflict' });
    logElectionFlowServer('flow-3', 'persisted');
    logElectionFlowServer('flow-3', 'notified', { users: 2 });

    expect(info.mock.calls).toEqual([
      ['[election-flow]', { flow: 'flow-1', stage: 'start' }],
      ['[election-flow]', { flow: 'flow-1', stage: 'done', electionId: 'election-1' }],
      ['[election-flow:server]', { flow: 'flow-3', stage: 'persisted' }],
      ['[election-flow:server]', { flow: 'flow-3', stage: 'notified', users: 2 }],
    ]);
    expect(error).toHaveBeenCalledTimes(2);
  });
});

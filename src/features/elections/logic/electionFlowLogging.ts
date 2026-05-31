const CLIENT_LOG_PREFIX = '[election-flow]';
const SERVER_LOG_PREFIX = '[election-flow:server]';

export function createElectionFlowCorrelationId(flow: string) {
  return `${flow}:${crypto.randomUUID()}`;
}

export function logElectionFlowClient(
  flow: string,
  stage: string,
  payload: Record<string, unknown> = {}
) {
  console.info(CLIENT_LOG_PREFIX, {
    flow,
    stage,
    ...payload,
  });
}

export function logElectionFlowClientError(
  flow: string,
  stage: string,
  payload: Record<string, unknown> = {}
) {
  console.error(CLIENT_LOG_PREFIX, {
    flow,
    stage,
    ...payload,
  });
}

export function logElectionFlowServer(
  flow: string,
  stage: string,
  payload: Record<string, unknown> = {}
) {
  console.info(SERVER_LOG_PREFIX, {
    flow,
    stage,
    ...payload,
  });
}

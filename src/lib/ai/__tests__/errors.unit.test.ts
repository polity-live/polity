import { describe, expect, it } from 'vitest';
import { AiAccessError, aiErrorCode } from '../errors';

describe('safe AI access errors', () => {
  it.each([401, 403])(
    'maps rejected credentials (%s) without exposing a provider payload',
    statusCode => {
      expect(
        aiErrorCode({ statusCode, message: 'secret provider response', responseBody: 'secret' })
      ).toBe('ai_credentials_invalid');
    }
  );
  it.each([402, 429])('maps billing and usage limits (%s)', status => {
    expect(aiErrorCode({ cause: { status } })).toBe(
      status === 429 ? 'ai_provider_rate_limited' : 'ai_usage_limit'
    );
  });
  it('preserves application errors and terminates cyclic/unknown causes', () => {
    expect(aiErrorCode(new AiAccessError('ai_access_unavailable', 'Internal details'))).toBe(
      'ai_access_unavailable'
    );
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;
    expect(aiErrorCode(cyclic)).toBe('ai_operation_failed');
  });
  it('does not turn a project tool permission failure into an invalid API key', () => {
    expect(aiErrorCode(Object.assign(new Error('No project access'), { status: 403 }))).toBe(
      'ai_operation_failed'
    );
  });
});

import { parseAppError, type AppErrorCode } from '@/features/shared/errors/app-error';

export class AiAccessError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AiAccessError';
  }
}

/** Return a safe, localizable code without sending provider responses or secrets. */
export function aiErrorCode(error: unknown): AppErrorCode {
  const visited = new Set<unknown>();
  let current = error;
  while (current && !visited.has(current)) {
    visited.add(current);
    if (current instanceof AiAccessError) return current.code;
    const payload = parseAppError(current);
    if (payload) return payload.code;
    if (typeof current !== 'object') break;
    const value = current as { statusCode?: number; status?: number; cause?: unknown };
    const status = value.statusCode ?? value.status;
    // SDK provider errors use statusCode. A tool's application HTTP status can
    // describe project permissions and must not be mistaken for rejected keys.
    if (value.statusCode === 401 || value.statusCode === 403) return 'ai_credentials_invalid';
    if (status === 429) return 'ai_provider_rate_limited';
    if (status === 402) return 'ai_usage_limit';
    const code = (current as { code?: string }).code;
    if (code === '22P02') return 'ai_invalid_identifier';
    if (
      code === 'ai_workspace_invalid' ||
      code === 'ai_workspace_unavailable' ||
      code === 'ai_invalid_identifier'
    )
      return code;
    current = value.cause;
  }
  return 'ai_operation_failed';
}

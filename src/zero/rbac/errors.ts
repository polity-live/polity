import type { ResourceType, ActionType } from './types';
import { encodeAppError } from '@/features/shared/errors';

/**
 * Error thrown when a permission check fails.
 * Carries typed resource/action info for structured error handling.
 *
 * On the client, useActions hooks catch this and show a toast.
 * On the server, mutators throw this to reject unauthorized writes.
 */
export class PermissionError extends Error {
  readonly code = 'PERMISSION_DENIED' as const;
  readonly resource: ResourceType;
  readonly action: ActionType;
  readonly scope?: string;

  constructor(action: ActionType, resource: ResourceType, scope?: string) {
    super(encodeAppError('permission_denied', { action, resource }));
    this.name = 'PermissionError';
    this.resource = resource;
    this.action = action;
    this.scope = scope;
  }
}

/** Type guard for PermissionError */
export function isPermissionError(error: unknown): error is PermissionError {
  return error instanceof PermissionError;
}

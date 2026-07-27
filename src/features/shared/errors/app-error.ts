import { translate as translateText } from '@/features/shared/hooks/use-translation';

export const APP_ERROR_PREFIX = '__POLITY_ERROR__:';
export const APP_ERROR_VERSION = 1 as const;

export const APP_ERROR_CODES = [
  'unknown',
  'action_blocked',
  'already_exists',
  'permission_denied',
  'resource_not_found',
  'validation_failed',
  'mutation_server_failed',
  'auth_service_unavailable',
  'upload_failed',
  'file_too_large',
  'payment_failed',
  'event_deadline_expired',
  'delegate_assembly_invalid',
  'vote_already_submitted',
  'vote_not_eligible',
  'voting_password_missing',
  'voting_password_invalid',
  'gender_quota_missing_gender',
  'gender_quota_unsupported_gender',
  'gender_quota_expected_male',
  'gender_quota_expected_female',
  'gender_quota_blocked',
  'dataset_operation_failed',
  'external_service_failed',
  'push_operation_failed',
  'tutorial_operation_failed',
  'ai_operation_failed',
  'ai_model_unavailable',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];
export type AppErrorParams = Record<string, string | number | undefined | null>;

export interface AppErrorPayload {
  version: typeof APP_ERROR_VERSION;
  code: AppErrorCode;
  params?: AppErrorParams;
}

const appErrorCodes = new Set<string>(APP_ERROR_CODES);

function isParams(value: unknown): value is AppErrorParams {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(
    item =>
      item === undefined || item === null || typeof item === 'string' || typeof item === 'number'
  );
}

function isAppErrorPayload(value: unknown): value is AppErrorPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Partial<AppErrorPayload>;
  return (
    payload.version === APP_ERROR_VERSION &&
    typeof payload.code === 'string' &&
    appErrorCodes.has(payload.code) &&
    (payload.params === undefined || isParams(payload.params))
  );
}

export function encodeAppError(code: AppErrorCode, params?: AppErrorParams): string {
  const payload: AppErrorPayload = {
    version: APP_ERROR_VERSION,
    code,
    ...(params && Object.keys(params).length > 0 ? { params } : {}),
  };
  return `${APP_ERROR_PREFIX}${JSON.stringify(payload)}`;
}

export class AppError extends Error {
  readonly payload: AppErrorPayload;

  constructor(payload: AppErrorPayload) {
    super(`${APP_ERROR_PREFIX}${JSON.stringify(payload)}`);
    this.name = 'AppError';
    this.payload = payload;
  }
}

export function throwAppError(code: AppErrorCode, params?: AppErrorParams): never {
  throw new AppError({
    version: APP_ERROR_VERSION,
    code,
    ...(params && Object.keys(params).length > 0 ? { params } : {}),
  });
}

function errorMessage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    return typeof message === 'string' ? message : null;
  }
  return null;
}

export function parseAppError(value: unknown): AppErrorPayload | null {
  if (value instanceof AppError) return value.payload;
  if (isAppErrorPayload(value)) return value;

  if (value && typeof value === 'object' && 'error' in value) {
    const nested = (value as { error?: unknown }).error;
    if (isAppErrorPayload(nested)) return nested;
  }

  const message = errorMessage(value);
  if (!message?.startsWith(APP_ERROR_PREFIX)) return null;

  try {
    const payload = JSON.parse(message.slice(APP_ERROR_PREFIX.length));
    return isAppErrorPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function localizeAppError(value: unknown, options: { logUnknown?: boolean } = {}): string {
  const payload = parseAppError(value);
  if (payload) {
    return translateText(`common.appErrors.${payload.code}`, payload.params);
  }

  if (options.logUnknown !== false && value != null) {
    console.error('Unlocalized application error', value);
  }
  return translateText('common.appErrors.unknown');
}

export function toAppError(value: unknown, fallbackCode: AppErrorCode = 'unknown'): AppError {
  return new AppError(
    parseAppError(value) ?? {
      version: APP_ERROR_VERSION,
      code: fallbackCode,
    }
  );
}

export function appErrorHttpBody(
  code: AppErrorCode,
  params?: AppErrorParams
): { error: AppErrorPayload } {
  return {
    error: {
      version: APP_ERROR_VERSION,
      code,
      ...(params && Object.keys(params).length > 0 ? { params } : {}),
    },
  };
}

export function appErrorHttpBodyFrom(
  value: unknown,
  fallbackCode: AppErrorCode = 'unknown'
): { error: AppErrorPayload } {
  const payload = parseAppError(value);
  if (payload) return { error: payload };
  if (value != null) console.error('Unstructured server error', value);
  return appErrorHttpBody(fallbackCode);
}

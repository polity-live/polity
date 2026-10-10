import { APP_ERROR_PREFIX, parseAppError } from '../../../src/features/shared/errors/app-error';

const names = [
  'Error',
  'ApplicationError',
  'PermissionError',
  'ClientError',
  'ProtocolError',
  'TypeError',
  'AssertionError',
] as const;
const missingMessages = {
  'Group not found': 'group-missing',
  'Guest access not found': 'guest-access-missing',
  'Membership not found': 'membership-missing',
  'Role not found': 'role-missing',
  'Theme not found': 'theme-missing',
} as const;
const clientKinds = [
  'AbruptClose',
  'CleanClose',
  'ClientClosed',
  'ConnectTimeout',
  'Hidden',
  'Internal',
  'InvalidMessage',
  'NoSocketOrigin',
  'Offline',
  'PingTimeout',
  'PullTimeout',
  'UnexpectedBaseCookie',
  'UserDisconnect',
] as const;
function shape(value: unknown) {
  const object =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
  const message = typeof object?.message === 'string' ? object.message : undefined;
  const body =
    object?.errorBody && typeof object.errorBody === 'object'
      ? (object.errorBody as Record<string, unknown>)
      : undefined;
  return {
    shape:
      value === null
        ? 'null'
        : typeof value === 'object'
          ? 'object'
          : typeof value === 'string'
            ? 'string'
            : 'other',
    errorInstance: value instanceof Error,
    name: names.find(name => name === object?.name) ?? 'unknown',
    sdkType: object?.type === 'app' ? 'app' : object?.type === 'zero' ? 'zero' : 'unknown',
    messagePresent: message !== undefined,
    encodedAppError: message?.startsWith(APP_ERROR_PREFIX) ?? false,
    permissionDenied: parseAppError(value)?.code === 'permission_denied',
    messageClass:
      message !== undefined && Object.hasOwn(missingMessages, message)
        ? missingMessages[message as keyof typeof missingMessages]
        : 'unknown',
    clientErrorKind: clientKinds.find(kind => kind === body?.kind) ?? 'unknown',
  } as const;
}
export function mutationErrorShape(value: unknown) {
  const causes: ReturnType<typeof shape>[] = [];
  let current = value;
  for (let depth = 0; depth < 2; depth++) {
    if (
      !current ||
      typeof current !== 'object' ||
      !('cause' in current) ||
      current.cause === undefined
    )
      break;
    current = current.cause;
    causes.push(shape(current));
  }
  return { ...shape(value), causes };
}

/** SDK logger withContext('maybeEndPull') records a key with an undefined value. */
export function mutationSDKErrorDiagnostic(context: unknown, args: readonly unknown[]) {
  const entries = context && typeof context === 'object' ? Object.entries(context) : [];
  const rebase = entries.some(
    ([key, value]) =>
      key === 'rebase' || key === 'maybeEndPull' || value === 'rebase' || value === 'maybeEndPull'
  );
  const error = args.find(value => value && typeof value === 'object' && 'message' in value);
  const message =
    error && typeof error === 'object' && 'message' in error ? error.message : undefined;
  return {
    context: rebase ? 'rebase' : 'unknown',
    missingRow:
      rebase &&
      [
        'Group not found',
        'Guest access not found',
        'Membership not found',
        'Role not found',
        'Theme not found',
      ].includes(message as string),
    error: mutationErrorShape(error),
  } as const;
}

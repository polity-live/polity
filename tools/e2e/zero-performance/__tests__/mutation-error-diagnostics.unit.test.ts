import { describe, expect, it } from 'vitest';
import { mutationErrorShape, mutationSDKErrorDiagnostic } from '../mutation-error-diagnostics';
describe('private mutation diagnostics', () => {
  it('exports only fixed classification without arbitrary values or messages', () => {
    const privateValue = 'private-password-token-argument';
    const result = mutationSDKErrorDiagnostic({ secret: privateValue }, [
      {
        name: privateValue,
        type: privateValue,
        message: privateValue,
        code: privateValue,
        details: privateValue,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain(privateValue);
    expect(result.context).toBe('unknown');
    expect(result.error.name).toBe('unknown');
    expect(result.error.sdkType).toBe('unknown');
    expect(result.missingRow).toBe(false);
  });
  it('requires actual SDK rebase context and exact static missing-row message', () => {
    expect(
      mutationSDKErrorDiagnostic({ method: 'maybeEndPull' }, [new Error('Guest access not found')])
        .missingRow
    ).toBe(true);
    expect(mutationSDKErrorDiagnostic({}, [new Error('Guest access not found')]).missingRow).toBe(
      false
    );
    expect(
      mutationSDKErrorDiagnostic({ method: 'rebase' }, [
        new Error('Guest access not found: private-id'),
      ]).missingRow
    ).toBe(false);
    expect(
      mutationSDKErrorDiagnostic({ method: 'not-rebase' }, ['rebase', new Error('Group not found')])
        .context
    ).toBe('unknown');
  });
  it('distinguishes SDK application, protocol, primitive and encoded permission shapes', () => {
    expect(
      mutationErrorShape({
        type: 'app',
        message: '__POLITY_ERROR__:{"version":1,"code":"permission_denied"}',
      })
    ).toMatchObject({ sdkType: 'app', encodedAppError: true, permissionDenied: true });
    expect(mutationErrorShape({ type: 'zero', message: 'private' }).sdkType).toBe('zero');
    expect(mutationErrorShape(null).shape).toBe('null');
    expect(mutationErrorShape('private').shape).toBe('string');
  });
  it('classifies exact missing-row messages independently of SDK context', () => {
    for (const [message, messageClass] of [
      ['Group not found', 'group-missing'],
      ['Guest access not found', 'guest-access-missing'],
      ['Membership not found', 'membership-missing'],
      ['Role not found', 'role-missing'],
      ['Theme not found', 'theme-missing'],
    ]) {
      const result = mutationSDKErrorDiagnostic({}, [new Error(message)]);
      expect(result.error.messageClass).toBe(messageClass);
      expect(result.context).toBe('unknown');
      expect(result.missingRow).toBe(false);
      expect(mutationErrorShape(new Error(`${message}: private`)).messageClass).toBe('unknown');
    }
    expect(
      mutationSDKErrorDiagnostic({ maybeEndPull: undefined }, [new Error('Group not found')])
    ).toMatchObject({ context: 'rebase', missingRow: true });
  });
  it('exports only allowlisted client kinds and at most two private-free cause shapes', () => {
    const secret = 'private-token';
    const error = {
      name: 'ClientError',
      message: secret,
      errorBody: { kind: 'Internal', message: secret },
      cause: new Error('Guest access not found', {
        cause: new Error(secret, { cause: new Error('Theme not found') }),
      }),
    };
    const result = mutationErrorShape(error);
    expect(result.clientErrorKind).toBe('Internal');
    expect(result.causes).toHaveLength(2);
    expect(result.causes[0].messageClass).toBe('guest-access-missing');
    expect(result.causes[1].messageClass).toBe('unknown');
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(mutationErrorShape({ errorBody: { kind: secret } }).clientErrorKind).toBe('unknown');
    const circular: { cause?: unknown } = {};
    circular.cause = circular;
    expect(mutationErrorShape(circular).causes).toHaveLength(2);
  });
});

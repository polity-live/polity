/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  APP_TUTORIAL_RECOVER_TARGET_EVENT,
  APP_TUTORIAL_SPOTLIGHT_TARGET_EVENT,
  APP_TUTORIAL_ACCEPT_NETWORK_EVENT,
  APP_TUTORIAL_ACTION_EVENT,
  reportAppTutorialAction,
  requestAppTutorialNetworkApproval,
  isAppTutorialActiveInDocument,
  activateAppTutorialSession,
  consumePendingAppTutorialNetworkApproval,
  deactivateAppTutorialSession,
  isAppTutorialSessionActive,
  requestAppTutorialTargetRecovery,
  requestAppTutorialSpotlightTarget,
  savePendingAppTutorialNetworkApproval,
} from '../events';

describe('app tutorial network approval storage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('rejects malformed and invalid stored approvals', () => {
    window.sessionStorage.setItem('polity:app-tutorial-pending-network', '{invalid');
    expect(consumePendingAppTutorialNetworkApproval('initiative-1')).toBeNull();
    for (const value of [
      { currentGroupId: 'initiative-1', requestId: 4, grantRequestIds: [] },
      { currentGroupId: 'initiative-1', requestId: 'request-1', grantRequestIds: null },
    ]) {
      window.sessionStorage.setItem('polity:app-tutorial-pending-network', JSON.stringify(value));
      expect(consumePendingAppTutorialNetworkApproval('initiative-1')).toBeNull();
    }
  });

  it('keeps the configured request available for Continue and consumes it once', () => {
    savePendingAppTutorialNetworkApproval({
      currentGroupId: 'initiative-1',
      requestId: 'request-1',
      grantRequestIds: ['information-1', 'amendment-1'],
      approveMembership: false,
    });

    expect(consumePendingAppTutorialNetworkApproval('another-group')).toBeNull();
    expect(consumePendingAppTutorialNetworkApproval('initiative-1')).toEqual({
      currentGroupId: 'initiative-1',
      requestId: 'request-1',
      grantRequestIds: ['information-1', 'amendment-1'],
      approveMembership: false,
    });
    expect(consumePendingAppTutorialNetworkApproval('initiative-1')).toBeNull();
  });
});

describe('app tutorial tab session', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('survives reads in the same tab and is removed on deactivation', () => {
    expect(isAppTutorialSessionActive()).toBe(false);

    activateAppTutorialSession();

    expect(isAppTutorialSessionActive()).toBe(true);
    deactivateAppTutorialSession();
    expect(isAppTutorialSessionActive()).toBe(false);
  });

  it('is inert without browser globals and reflects the active body marker', () => {
    expect(isAppTutorialActiveInDocument()).toBe(false);
    document.body.setAttribute('data-app-tutorial-active', '');
    expect(isAppTutorialActiveInDocument()).toBe(true);
    document.body.removeAttribute('data-app-tutorial-active');

    vi.stubGlobal('window', undefined);
    try {
      expect(isAppTutorialSessionActive()).toBe(false);
      expect(activateAppTutorialSession()).toBeUndefined();
      expect(deactivateAppTutorialSession()).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('dispatches tutorial actions and network approval requests', () => {
    const action = vi.fn();
    const approval = vi.fn();
    window.addEventListener(APP_TUTORIAL_ACTION_EVENT, action);
    window.addEventListener(APP_TUTORIAL_ACCEPT_NETWORK_EVENT, approval);
    reportAppTutorialAction({ type: 'click', anchor: 'target' });
    requestAppTutorialNetworkApproval();
    expect(action).toHaveBeenCalledOnce();
    expect(approval).toHaveBeenCalledOnce();
    window.removeEventListener(APP_TUTORIAL_ACTION_EVENT, action);
    window.removeEventListener(APP_TUTORIAL_ACCEPT_NETWORK_EVENT, approval);
  });
});

describe('app tutorial target recovery', () => {
  it('dispatches the requested anchor to mounted feature controllers', () => {
    const recover = vi.fn();
    window.addEventListener(APP_TUTORIAL_RECOVER_TARGET_EVENT, recover);

    requestAppTutorialTargetRecovery('agenda-amendment-password');

    expect(recover).toHaveBeenCalledOnce();
    expect(recover.mock.calls[0]?.[0]).toMatchObject({
      detail: { anchor: 'agenda-amendment-password' },
    });
    window.removeEventListener(APP_TUTORIAL_RECOVER_TARGET_EVENT, recover);
  });
});

describe('app tutorial spotlight target', () => {
  it('dispatches an immediate spotlight override', () => {
    const spotlight = vi.fn();
    window.addEventListener(APP_TUTORIAL_SPOTLIGHT_TARGET_EVENT, spotlight);

    requestAppTutorialSpotlightTarget('tutorial-assistant-chat');

    expect(spotlight).toHaveBeenCalledOnce();
    expect(spotlight.mock.calls[0]?.[0]).toMatchObject({
      detail: { anchor: 'tutorial-assistant-chat' },
    });
    window.removeEventListener(APP_TUTORIAL_SPOTLIGHT_TARGET_EVENT, spotlight);
  });
});

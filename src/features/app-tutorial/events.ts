import type { TutorialAdvanceEvidence } from '@/server/app-tutorial/service';

export const APP_TUTORIAL_ACTION_EVENT = 'polity:app-tutorial-action';
export const APP_TUTORIAL_ACCEPT_NETWORK_EVENT = 'polity:app-tutorial-accept-network';
export const APP_TUTORIAL_ACTIVE_BODY_ATTRIBUTE = 'data-app-tutorial-active';
export const APP_TUTORIAL_AVATAR_MENU_OPENED_ACTION = 'avatar-menu.opened';
export const APP_TUTORIAL_OSM_LOAD_FAILED_ACTION = 'city-design.osm-load-failed';
export const APP_TUTORIAL_RECOVER_TARGET_EVENT = 'polity:app-tutorial-recover-target';
export const APP_TUTORIAL_SESSION_CHANGE_EVENT = 'polity:app-tutorial-session-change';
export const APP_TUTORIAL_SPOTLIGHT_TARGET_EVENT = 'polity:app-tutorial-spotlight-target';
const APP_TUTORIAL_PENDING_NETWORK_STORAGE_KEY = 'polity:app-tutorial-pending-network';
const APP_TUTORIAL_SESSION_STORAGE_KEY = 'polity:app-tutorial-session-active';

export interface PendingAppTutorialNetworkApproval {
  currentGroupId: string;
  requestId: string;
  grantRequestIds: string[];
  approveMembership: boolean;
}

export interface AppTutorialTargetRecoveryRequest {
  anchor: string;
}

export interface AppTutorialSpotlightTargetRequest {
  anchor: string;
}

export function reportAppTutorialAction(evidence: TutorialAdvanceEvidence) {
  window.dispatchEvent(
    new CustomEvent<TutorialAdvanceEvidence>(APP_TUTORIAL_ACTION_EVENT, {
      detail: evidence,
    })
  );
}

export function isAppTutorialActiveInDocument() {
  return (
    typeof document !== 'undefined' &&
    document.body.hasAttribute(APP_TUTORIAL_ACTIVE_BODY_ATTRIBUTE)
  );
}

export function isAppTutorialSessionActive() {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(APP_TUTORIAL_SESSION_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function activateAppTutorialSession() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(APP_TUTORIAL_SESSION_STORAGE_KEY, '1');
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  } finally {
    window.dispatchEvent(new Event(APP_TUTORIAL_SESSION_CHANGE_EVENT));
  }
}

export function deactivateAppTutorialSession() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(APP_TUTORIAL_SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(APP_TUTORIAL_PENDING_NETWORK_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  } finally {
    window.dispatchEvent(new Event(APP_TUTORIAL_SESSION_CHANGE_EVENT));
  }
}

export function savePendingAppTutorialNetworkApproval(approval: PendingAppTutorialNetworkApproval) {
  window.sessionStorage.setItem(APP_TUTORIAL_PENDING_NETWORK_STORAGE_KEY, JSON.stringify(approval));
}

export function consumePendingAppTutorialNetworkApproval(
  currentGroupId: string
): PendingAppTutorialNetworkApproval | null {
  const stored = window.sessionStorage.getItem(APP_TUTORIAL_PENDING_NETWORK_STORAGE_KEY);
  if (!stored) return null;
  try {
    const approval = JSON.parse(stored) as PendingAppTutorialNetworkApproval;
    if (
      approval.currentGroupId !== currentGroupId ||
      typeof approval.requestId !== 'string' ||
      !Array.isArray(approval.grantRequestIds)
    ) {
      return null;
    }
    window.sessionStorage.removeItem(APP_TUTORIAL_PENDING_NETWORK_STORAGE_KEY);
    return approval;
  } catch {
    window.sessionStorage.removeItem(APP_TUTORIAL_PENDING_NETWORK_STORAGE_KEY);
    return null;
  }
}

export function requestAppTutorialNetworkApproval() {
  window.dispatchEvent(new Event(APP_TUTORIAL_ACCEPT_NETWORK_EVENT));
}

export function requestAppTutorialTargetRecovery(anchor: string) {
  window.dispatchEvent(
    new CustomEvent<AppTutorialTargetRecoveryRequest>(APP_TUTORIAL_RECOVER_TARGET_EVENT, {
      detail: { anchor },
    })
  );
}

export function requestAppTutorialSpotlightTarget(anchor: string) {
  window.dispatchEvent(
    new CustomEvent<AppTutorialSpotlightTargetRequest>(APP_TUTORIAL_SPOTLIGHT_TARGET_EVENT, {
      detail: { anchor },
    })
  );
}

declare global {
  interface WindowEventMap {
    [APP_TUTORIAL_ACTION_EVENT]: CustomEvent<TutorialAdvanceEvidence>;
    [APP_TUTORIAL_ACCEPT_NETWORK_EVENT]: Event;
    [APP_TUTORIAL_RECOVER_TARGET_EVENT]: CustomEvent<AppTutorialTargetRecoveryRequest>;
    [APP_TUTORIAL_SESSION_CHANGE_EVENT]: Event;
    [APP_TUTORIAL_SPOTLIGHT_TARGET_EVENT]: CustomEvent<AppTutorialSpotlightTargetRequest>;
  }
}

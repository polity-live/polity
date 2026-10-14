export const STUDIO_OPEN_PANEL_EVENT = 'studio-open-panel';
export const STUDIO_CLOSE_PANELS_EVENT = 'studio-close-panels';

export function closeStudioPanels() {
  window.dispatchEvent(new Event(STUDIO_CLOSE_PANELS_EVENT));
}

export interface StudioOpenPanelRequest {
  panelKey: string;
  origin?: 'secondary-navigation';
  navigationItemId?: string;
}

export function parseStudioOpenPanelRequest(detail: unknown): StudioOpenPanelRequest | null {
  if (typeof detail === 'string') return { panelKey: detail };
  if (!detail || typeof detail !== 'object') return null;

  const request = detail as Partial<StudioOpenPanelRequest>;
  if (typeof request.panelKey !== 'string') return null;
  if (request.origin !== undefined && request.origin !== 'secondary-navigation') return null;
  if (request.navigationItemId !== undefined && typeof request.navigationItemId !== 'string')
    return null;

  return {
    panelKey: request.panelKey,
    origin: request.origin,
    navigationItemId: request.navigationItemId,
  };
}

export function openStudioPanel(request: StudioOpenPanelRequest | string) {
  window.dispatchEvent(new CustomEvent(STUDIO_OPEN_PANEL_EVENT, { detail: request }));
}

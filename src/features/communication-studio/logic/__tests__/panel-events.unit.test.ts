import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  openStudioPanel,
  parseStudioOpenPanelRequest,
  STUDIO_OPEN_PANEL_EVENT,
} from '../panel-events';
afterEach(() => vi.unstubAllGlobals());
describe('Studio panel navigation events', () => {
  it('accepts legacy panel keys and typed secondary navigation requests', () => {
    expect(parseStudioOpenPanelRequest('layers')).toEqual({ panelKey: 'layers' });
    expect(parseStudioOpenPanelRequest({ panelKey: 'assets' })).toEqual({
      panelKey: 'assets',
      origin: undefined,
      navigationItemId: undefined,
    });
    const request = {
      panelKey: 'text',
      origin: 'secondary-navigation',
      navigationItemId: 'studio-text',
    } as const;
    expect(parseStudioOpenPanelRequest(request)).toEqual(request);
  });
  it.each([
    null,
    undefined,
    0,
    false,
    [],
    {},
    { panelKey: 1 },
    { panelKey: 'text', origin: 'unknown' },
    { panelKey: 'text', navigationItemId: 7 },
  ])('rejects malformed panel navigation detail %j', detail => {
    expect(parseStudioOpenPanelRequest(detail)).toBeNull();
  });
  it('dispatches typed and legacy requests to subscribed browser listeners', () => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    const received: unknown[] = [];
    target.addEventListener(STUDIO_OPEN_PANEL_EVENT, event =>
      received.push((event as CustomEvent).detail)
    );
    const request = { panelKey: 'layers', origin: 'secondary-navigation' } as const;
    openStudioPanel(request);
    openStudioPanel('assets');
    expect(received).toEqual([request, 'assets']);
  });
});

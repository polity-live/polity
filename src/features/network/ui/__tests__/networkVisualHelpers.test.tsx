import { describe, expect, it } from 'vitest';

import {
  createEntityNodeLegendItem,
  createProcessStatusLegendItem,
  createWorkflowStepLegendItem,
  getCivicNetworkMiniMapNodeColor,
  getCivicNetworkNodeLegendItem,
  getCivicNetworkNodeStyle,
  getEntityNetworkEdgeColor,
  getEntityNetworkNodeStyle,
  getGroupNodeStyle,
  getNetworkSelectionStyle,
  getProcessStatusNodeAccent,
  getProcessStatusVisualTokens,
  getWorkflowStepNodeStyle,
} from '../networkVisualHelpers';

describe('networkVisualHelpers civic flow visuals', () => {
  it('maps workflow step roles to the group network node language', () => {
    const startStyle = getWorkflowStepNodeStyle('start');
    const intermediateStyle = getWorkflowStepNodeStyle('intermediate');
    const endStyle = getWorkflowStepNodeStyle('end');

    expect(startStyle).toMatchObject({
      background: getGroupNodeStyle('current').background,
      borderRadius: '10px',
      textAlign: 'center',
      width: 190,
    });
    expect(intermediateStyle.background).toBe(getGroupNodeStyle('parent').background);
    expect(endStyle.background).toBe(getGroupNodeStyle('child').background);
    expect(String(startStyle.background)).not.toContain('bg-gradient');

    const legendItem = createWorkflowStepLegendItem({
      id: 'workflow-start',
      label: 'Start',
      role: 'start',
    });

    expect(legendItem).toMatchObject({
      id: 'workflow-start',
      label: 'Start',
    });
    expect(legendItem.swatch).toBeTruthy();
  });

  it('exposes process status accents and legend swatches from shared tokens', () => {
    const activeAccent = getProcessStatusNodeAccent('active-next');

    expect(activeAccent).toEqual(getProcessStatusVisualTokens('active-next'));
    expect(activeAccent.borderColor).toBeTruthy();
    expect(String(activeAccent.backgroundColor)).not.toContain('bg-gradient');

    const legendItem = createProcessStatusLegendItem({
      id: 'active-next',
      label: 'Next step',
      state: 'active-next',
    });

    expect(legendItem).toMatchObject({
      id: 'active-next',
      label: 'Next step',
    });
    expect(legendItem.swatch).toBeTruthy();
  });

  it('exposes entity node styles and selection styles from civic entity tokens', () => {
    const userStyle = getEntityNetworkNodeStyle('user', {
      width: 180,
      height: 180,
      borderRadius: '999px',
    });
    const eventStyle = getEntityNetworkNodeStyle('event');

    expect(userStyle).toMatchObject({
      background: 'var(--card)',
      color: 'var(--card-foreground)',
      border: '1px solid var(--entity-user-border)',
      borderColor: 'var(--entity-user-border)',
      borderStyle: 'solid',
      borderWidth: 1,
      width: 180,
      height: 180,
      borderRadius: '999px',
    });
    expect(eventStyle).toMatchObject({
      background: 'var(--card)',
      color: 'var(--card-foreground)',
      border: '1px solid var(--entity-event-border)',
      borderColor: 'var(--entity-event-border)',
    });
    expect(String(eventStyle.boxShadow)).toContain('var(--entity-event-border)');
    expect(getEntityNetworkEdgeColor('event')).toBe('var(--entity-event-border)');
    expect(getNetworkSelectionStyle(true).boxShadow).toContain('var(--ring)');
    expect(getNetworkSelectionStyle(false)).toEqual({});

    const legendItem = createEntityNodeLegendItem({
      id: 'event',
      label: 'Event',
      entityType: 'event',
    });

    expect(legendItem).toMatchObject({
      id: 'event',
      label: 'Event',
    });
    expect(legendItem.swatch).toBeTruthy();
  });

  it('builds neutral civic node styles and legend items for shared flow modules', () => {
    const groupStyle = getCivicNetworkNodeStyle({ type: 'group', visualVariant: 'current' });
    const processStyle = getCivicNetworkNodeStyle({ type: 'process', state: 'active-next' });

    expect(String(groupStyle.background)).toContain('var(--entity-group-border)');
    expect(String(groupStyle.background)).toContain('var(--card)');
    expect(groupStyle.color).toBe('var(--entity-group-fg)');
    expect(String(groupStyle.border)).toContain('var(--entity-group-border)');
    expect(groupStyle.borderColor).toBe('var(--entity-group-border)');
    expect(groupStyle.borderStyle).toBe('solid');
    expect(String(processStyle.border)).toContain('var(--badge-info-border)');
    expect(String(groupStyle.background)).not.toContain('bg-gradient');

    const legendItem = getCivicNetworkNodeLegendItem({
      id: 'current-group',
      label: 'Current group',
      kind: { type: 'group', visualVariant: 'current' },
    });

    expect(legendItem).toMatchObject({
      id: 'current-group',
      label: 'Current group',
    });
    expect(legendItem.swatch).toBeTruthy();
  });

  it('uses civic entity and status colors for minimap nodes', () => {
    expect(getCivicNetworkMiniMapNodeColor({ data: { entityType: 'user' } })).toBe(
      'var(--entity-user-border)'
    );
    expect(getCivicNetworkMiniMapNodeColor({ data: { processState: 'rejected' } })).toBe(
      'var(--badge-danger-border)'
    );
    expect(getCivicNetworkMiniMapNodeColor({ data: { visualVariant: 'child' } })).toBe(
      'var(--badge-warning-border)'
    );
  });
});

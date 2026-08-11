import { describe, expect, it } from 'vitest';

import {
  createEntityNodeLegendItem,
  createGroupNodeLegendItem,
  createProcessStatusLegendItem,
  createWorkflowStepLegendItem,
  getCivicNetworkMiniMapNodeColor,
  getCivicNetworkNodeLegendItem,
  getCivicNetworkNodeStyle,
  getEntityNetworkEdgeColor,
  getEntityNetworkNodeStyle,
  getGroupDisplayLabel,
  getGroupNodeDisplayLabel,
  getGroupNodeLegendSwatch,
  getGroupNodeStyle,
  getGroupNodeVisualTokens,
  getGroupNodeVisualVariant,
  getNetworkSelectionStyle,
  getProcessStatusNodeAccent,
  getProcessStatusVisualTokens,
  getWorkflowStepNodeStyle,
  renderRightsEdgeLabel,
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

  it('covers every minimap discriminator and safe group fallback', () => {
    for (const entityType of ['user', 'group', 'event', 'amendment', 'blog'] as const) {
      expect(getCivicNetworkMiniMapNodeColor({ data: { entityType } })).toContain(entityType);
    }
    expect(getCivicNetworkMiniMapNodeColor({ data: { type: 'user' } })).toContain('user');
    expect(getCivicNetworkMiniMapNodeColor({ data: { type: 'user-center' } })).toContain('user');
    expect(getCivicNetworkMiniMapNodeColor({ data: { type: 'event' } })).toContain('event');
    expect(getCivicNetworkMiniMapNodeColor({ data: { type: 'event-center' } })).toContain('event');
    expect(getCivicNetworkMiniMapNodeColor({ data: { type: 'amendment' } })).toContain('amendment');
    expect(getCivicNetworkMiniMapNodeColor({ type: 'user' })).toContain('user');

    for (const visualVariant of [
      'current',
      'parent',
      'child',
      'sibling-open',
      'sibling-elected',
      'sibling-parliament',
    ] as const) {
      expect(getCivicNetworkMiniMapNodeColor({ data: { visualVariant } })).toBeTruthy();
    }
    for (const processState of ['approved', 'active-next', 'pending', 'rejected'] as const) {
      expect(getCivicNetworkMiniMapNodeColor({ data: { processState } })).toBeTruthy();
    }
    expect(getCivicNetworkMiniMapNodeColor({ data: { status: 'approved' } })).toBe(
      'var(--badge-success-border)'
    );
    expect(
      getCivicNetworkMiniMapNodeColor({ data: { entityType: 'other', visualVariant: 'other' } })
    ).toBe('var(--entity-group-border)');
    expect(getCivicNetworkMiniMapNodeColor({})).toBe('var(--entity-group-border)');
  });

  it('covers group roles, display labels, tokens, swatches, and right labels', () => {
    expect(getGroupNodeVisualVariant({ role: 'current' })).toBe('current');
    expect(getGroupNodeVisualVariant({ role: 'parent' })).toBe('parent');
    expect(getGroupNodeVisualVariant({ role: 'child' })).toBe('child');
    expect(getGroupNodeVisualVariant({ role: 'sibling', siblingMembershipMode: 'elected' })).toBe(
      'sibling-elected'
    );
    expect(
      getGroupNodeVisualVariant({ role: 'sibling', siblingMembershipMode: 'parliament' })
    ).toBe('sibling-parliament');
    expect(getGroupNodeVisualVariant({ role: 'sibling', siblingMembershipMode: null })).toBe(
      'sibling-open'
    );
    expect(getGroupNodeVisualTokens('parent')).not.toBe(getGroupNodeVisualTokens('parent'));
    expect(getGroupNodeDisplayLabel('Council', 'current')).toContain('Council');
    expect(getGroupNodeDisplayLabel(null, 'current')).toBe('● ');
    expect(getGroupNodeLegendSwatch('child')).toBeTruthy();
    expect(
      createGroupNodeLegendItem({ id: 'group', label: 'Group', visualVariant: 'current' }).swatch
    ).toBeTruthy();

    expect(getGroupDisplayLabel('Council', 'HIERARCHICAL')).toContain('🏛');
    expect(getGroupDisplayLabel(null, 'hierarchical')).toBe('🏛 ');
    expect(getGroupDisplayLabel('Council', 'base')).toContain('◉');
    expect(getGroupDisplayLabel(null, 'base')).toBe('◉ ');
    expect(getGroupDisplayLabel('Council', 'sibling')).toContain('◎');
    expect(getGroupDisplayLabel(null, 'sibling')).toBe('◎ ');
    expect(getGroupDisplayLabel('Council', 'other')).toBe('Council');
    expect(getGroupDisplayLabel(null, null)).toBe('');
    expect(renderRightsEdgeLabel([])).toBeTruthy();
    expect(renderRightsEdgeLabel(['amendmentRight'])).toBeTruthy();
  });

  it('honors every civic style override and primary-emphasis branch', () => {
    const options = {
      width: 220,
      height: 120,
      borderRadius: '2px',
      padding: '3px',
      fontSize: '14px',
      fontWeight: '500',
      textAlign: 'left' as const,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: 'none',
      borderWidth: 7,
    };
    expect(getCivicNetworkNodeStyle({ type: 'entity', entityType: 'blog' }, options)).toMatchObject(
      options
    );
    expect(getCivicNetworkNodeStyle({ type: 'group', visualVariant: 'parent' }).borderWidth).toBe(
      2
    );
    expect(getCivicNetworkNodeStyle({ type: 'group', visualVariant: 'current' }).fontWeight).toBe(
      '700'
    );
    expect(getCivicNetworkNodeStyle({ type: 'workflow', role: 'start' }).fontWeight).toBe('700');
    expect(getCivicNetworkNodeStyle({ type: 'workflow', role: 'end' }).fontWeight).toBe('600');
    expect(getCivicNetworkNodeStyle({ type: 'process', state: 'active-next' }).fontWeight).toBe(
      '700'
    );
    expect(getCivicNetworkNodeStyle({ type: 'process', state: 'pending' }).fontWeight).toBe('600');
    expect(getWorkflowStepNodeStyle('intermediate', { width: 250 }).width).toBe(250);
  });
});

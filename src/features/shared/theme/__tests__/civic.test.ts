import { describe, expect, it } from 'vitest';

import {
  getBadgeToneClasses,
  getContentTypeToneClasses,
  getEntityToneClasses,
  getEntityGradientClasses,
  getHashtagToneClasses,
  getMotionPreset,
  getPlateSurfaceClasses,
  getRightToneClasses,
  getRoleToneClasses,
  getSemanticToneClasses,
  getTableTagToneClasses,
  getTypeaheadRowToneClasses,
  getValidationToneClasses,
  isPrimaryEntityTone,
} from '../civic';

describe('civic theme helpers', () => {
  it('returns token-backed semantic tone classes', () => {
    expect(getSemanticToneClasses('success').badge).toContain('--badge-success-bg');
    expect(getBadgeToneClasses('danger')).toContain('--badge-danger-bg');
    expect(getValidationToneClasses('invalid')).toContain('--badge-danger-border');
  });

  it('returns primary entity token classes and secondary semantic fallbacks', () => {
    expect(isPrimaryEntityTone('blog')).toBe(true);
    expect(isPrimaryEntityTone('vote')).toBe(false);
    expect(getEntityToneClasses('blog').badge).toContain('--entity-blog-bg');
    expect(getEntityToneClasses('agenda_item').badge).toContain('--badge-info-bg');
    expect(getEntityToneClasses('vote').badge).toContain('--badge-danger-bg');
    expect(getEntityToneClasses('todo').badge).toContain('--badge-success-bg');
    expect(getEntityToneClasses('role').badge).toContain('--badge-neutral-bg');
  });

  it('exposes table, typeahead, Plate, and motion presets', () => {
    expect(getTableTagToneClasses('event')).toContain('--entity-event-bg');
    expect(getTypeaheadRowToneClasses('user')).toContain('--entity-user-bg');
    expect(getPlateSurfaceClasses('toolbar')).toContain('--surface-overlay');
    expect(getMotionPreset('hoverLift')).toBe('civic-motion-hover-lift');
  });

  it('maps content types, plain surfaces, roles, hashtags, and rights to Civic tokens', () => {
    expect(getEntityToneClasses('event').gradient).toBe(
      'border-[var(--entity-event-border)] bg-[var(--entity-event-bg)]'
    );
    expect(getEntityToneClasses('event').softSurface).toBe(
      'border-[var(--entity-event-border)] bg-[var(--entity-event-bg)]'
    );
    expect(getContentTypeToneClasses('event').badge).toContain('--entity-event-bg');
    expect(getContentTypeToneClasses('vote').badge).toContain('--badge-danger-bg');
    expect(getEntityGradientClasses('event')).toContain('--entity-event-bg');
    expect(getEntityGradientClasses('event')).not.toContain('bg-gradient');
    expect(getEntityGradientClasses('group')).toContain('--entity-group-bg');
    expect(getEntityGradientClasses('group')).not.toContain('bg-gradient');
    expect(getEntityGradientClasses('agenda_item')).toContain('--badge-info-bg');
    expect(getEntityGradientClasses('agenda_item')).not.toContain('bg-gradient');
    expect(getRoleToneClasses().badge).toContain('--badge-neutral-bg');
    expect(getHashtagToneClasses().badge).toContain('--badge-accent-bg');
    expect(getRightToneClasses('amendmentRight').badge).toContain('--entity-amendment-bg');
    expect(getRightToneClasses('unknownRight').badge).toContain('--badge-neutral-bg');
  });
});

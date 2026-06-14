import { describe, expect, it } from 'vitest';

import {
  getBadgeToneClasses,
  getEntityToneClasses,
  getMotionPreset,
  getPlateSurfaceClasses,
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
});

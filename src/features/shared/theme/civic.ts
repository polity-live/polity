export type SemanticTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'destructive'
  | 'accent'
  | 'outline';

export type PrimaryEntityTone = 'user' | 'group' | 'event' | 'amendment' | 'blog';

export type EntityTone = PrimaryEntityTone | 'agenda_item' | 'vote' | 'election' | 'todo' | 'role';

export type BadgeToneKind = SemanticTone | EntityTone;

export type ValidationState = 'idle' | 'valid' | 'invalid' | 'warning' | 'pending';

export type PlateSurface = 'editor' | 'toolbar' | 'floating' | 'suggestion' | 'comment' | 'code';

export type MotionPreset =
  | 'none'
  | 'colors'
  | 'hoverLift'
  | 'press'
  | 'panelReveal'
  | 'dialogContent'
  | 'popoverContent'
  | 'rowHighlight'
  | 'loadingShimmer'
  | 'attention'
  | 'navigation';

export interface CivicToneClasses {
  badge: string;
  dot: string;
  text: string;
  border: string;
  surface: string;
  ring: string;
  tableTag: string;
  typeaheadRow: string;
}

export interface CivicEntityToneClasses extends CivicToneClasses {
  base: string;
  gradient: string;
  headerAccent: string;
  softSurface: string;
}

const SEMANTIC_TONE_CLASS_NAMES: Record<SemanticTone, CivicToneClasses> = {
  neutral: {
    badge:
      'border-[var(--badge-neutral-border)] bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]',
    dot: 'bg-[var(--badge-neutral-fg)]',
    text: 'text-[var(--badge-neutral-fg)]',
    border: 'border-[var(--badge-neutral-border)]',
    surface:
      'border-[var(--badge-neutral-border)] bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]',
    ring: 'ring-[var(--badge-neutral-border)]',
    tableTag:
      'border-[var(--badge-neutral-border)] bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]',
    typeaheadRow:
      'hover:bg-[var(--badge-neutral-bg)] data-[selected=true]:bg-[var(--badge-neutral-bg)]',
  },
  info: {
    badge:
      'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
    dot: 'bg-[var(--badge-info-fg)]',
    text: 'text-[var(--badge-info-fg)]',
    border: 'border-[var(--badge-info-border)]',
    surface:
      'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
    ring: 'ring-[var(--badge-info-border)]',
    tableTag:
      'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
    typeaheadRow: 'hover:bg-[var(--badge-info-bg)] data-[selected=true]:bg-[var(--badge-info-bg)]',
  },
  success: {
    badge:
      'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
    dot: 'bg-[var(--badge-success-fg)]',
    text: 'text-[var(--badge-success-fg)]',
    border: 'border-[var(--badge-success-border)]',
    surface:
      'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
    ring: 'ring-[var(--badge-success-border)]',
    tableTag:
      'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
    typeaheadRow:
      'hover:bg-[var(--badge-success-bg)] data-[selected=true]:bg-[var(--badge-success-bg)]',
  },
  warning: {
    badge:
      'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]',
    dot: 'bg-[var(--badge-warning-fg)]',
    text: 'text-[var(--badge-warning-fg)]',
    border: 'border-[var(--badge-warning-border)]',
    surface:
      'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]',
    ring: 'ring-[var(--badge-warning-border)]',
    tableTag:
      'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]',
    typeaheadRow:
      'hover:bg-[var(--badge-warning-bg)] data-[selected=true]:bg-[var(--badge-warning-bg)]',
  },
  danger: {
    badge:
      'border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]',
    dot: 'bg-[var(--badge-danger-fg)]',
    text: 'text-[var(--badge-danger-fg)]',
    border: 'border-[var(--badge-danger-border)]',
    surface:
      'border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]',
    ring: 'ring-[var(--badge-danger-border)]',
    tableTag:
      'border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]',
    typeaheadRow:
      'hover:bg-[var(--badge-danger-bg)] data-[selected=true]:bg-[var(--badge-danger-bg)]',
  },
  destructive: {
    badge:
      'border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]',
    dot: 'bg-[var(--badge-danger-fg)]',
    text: 'text-[var(--badge-danger-fg)]',
    border: 'border-[var(--badge-danger-border)]',
    surface:
      'border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]',
    ring: 'ring-[var(--badge-danger-border)]',
    tableTag:
      'border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]',
    typeaheadRow:
      'hover:bg-[var(--badge-danger-bg)] data-[selected=true]:bg-[var(--badge-danger-bg)]',
  },
  accent: {
    badge:
      'border-[var(--badge-accent-border)] bg-[var(--badge-accent-bg)] text-[var(--badge-accent-fg)]',
    dot: 'bg-[var(--badge-accent-fg)]',
    text: 'text-[var(--badge-accent-fg)]',
    border: 'border-[var(--badge-accent-border)]',
    surface:
      'border-[var(--badge-accent-border)] bg-[var(--badge-accent-bg)] text-[var(--badge-accent-fg)]',
    ring: 'ring-[var(--badge-accent-border)]',
    tableTag:
      'border-[var(--badge-accent-border)] bg-[var(--badge-accent-bg)] text-[var(--badge-accent-fg)]',
    typeaheadRow:
      'hover:bg-[var(--badge-accent-bg)] data-[selected=true]:bg-[var(--badge-accent-bg)]',
  },
  outline: {
    badge: 'border-border bg-transparent text-foreground',
    dot: 'bg-muted-foreground',
    text: 'text-foreground',
    border: 'border-border',
    surface: 'border-border bg-background text-foreground',
    ring: 'ring-ring',
    tableTag: 'border-border bg-background text-foreground',
    typeaheadRow: 'hover:bg-accent data-[selected=true]:bg-accent',
  },
};

const PRIMARY_ENTITY_CLASS_NAMES: Record<PrimaryEntityTone, CivicEntityToneClasses> = {
  user: createEntityToneClasses('user'),
  group: createEntityToneClasses('group'),
  event: createEntityToneClasses('event'),
  amendment: createEntityToneClasses('amendment'),
  blog: createEntityToneClasses('blog'),
};

const SECONDARY_ENTITY_TO_SEMANTIC_TONE = {
  agenda_item: 'info',
  vote: 'danger',
  election: 'accent',
  todo: 'success',
  role: 'neutral',
} as const satisfies Record<Exclude<EntityTone, PrimaryEntityTone>, SemanticTone>;

const VALIDATION_CLASS_NAMES: Record<ValidationState, string> = {
  idle: 'border-input focus-visible:border-ring focus-visible:ring-ring/35',
  valid:
    'border-[var(--badge-success-border)] focus-visible:border-[var(--badge-success-border)] focus-visible:ring-[var(--badge-success-border)]',
  invalid:
    'border-[var(--badge-danger-border)] focus-visible:border-[var(--badge-danger-border)] focus-visible:ring-[var(--badge-danger-border)]',
  warning:
    'border-[var(--badge-warning-border)] focus-visible:border-[var(--badge-warning-border)] focus-visible:ring-[var(--badge-warning-border)]',
  pending:
    'border-[var(--badge-info-border)] focus-visible:border-[var(--badge-info-border)] focus-visible:ring-[var(--badge-info-border)]',
};

const PLATE_SURFACE_CLASS_NAMES: Record<PlateSurface, string> = {
  editor: 'border-border bg-card text-card-foreground shadow-[var(--shadow-panel)]',
  toolbar:
    'border-border bg-[var(--surface-overlay)] text-foreground shadow-[var(--shadow-panel)] backdrop-blur-md',
  floating:
    'border-border bg-popover text-popover-foreground shadow-[var(--shadow-floating)] civic-motion-popover',
  suggestion:
    'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
  comment:
    'border-[var(--badge-accent-border)] bg-[var(--badge-accent-bg)] text-[var(--badge-accent-fg)]',
  code: 'border-border bg-[var(--surface-sunken)] text-foreground font-mono',
};

const MOTION_PRESET_CLASS_NAMES: Record<MotionPreset, string> = {
  none: '',
  colors:
    'transition-[color,background-color,border-color,box-shadow] duration-[var(--motion-duration-base)] ease-[var(--motion-ease-standard)]',
  hoverLift: 'civic-motion-hover-lift',
  press: 'civic-motion-press',
  panelReveal: 'civic-motion-panel',
  dialogContent: 'civic-motion-panel',
  popoverContent: 'civic-motion-popover',
  rowHighlight: 'civic-row-highlight',
  loadingShimmer: 'civic-shimmer',
  attention: 'animate-civic-scale-in',
  navigation:
    'transition-[transform,opacity,box-shadow] duration-[var(--motion-duration-slow)] ease-[var(--motion-ease-soft)]',
};

function createEntityToneClasses(entity: PrimaryEntityTone): CivicEntityToneClasses {
  return {
    base: `text-[var(--entity-${entity}-base)]`,
    badge: `border-[var(--entity-${entity}-border)] bg-[var(--entity-${entity}-bg)] text-[var(--entity-${entity}-fg)]`,
    dot: `bg-[var(--entity-${entity}-base)]`,
    text: `text-[var(--entity-${entity}-fg)]`,
    border: `border-[var(--entity-${entity}-border)]`,
    surface: `border-[var(--entity-${entity}-border)] bg-[var(--entity-${entity}-bg)] text-[var(--entity-${entity}-fg)]`,
    softSurface: `border-[var(--entity-${entity}-border)] bg-[var(--entity-${entity}-bg)]`,
    ring: `ring-[var(--entity-${entity}-ring)]`,
    gradient: `bg-[image:var(--entity-${entity}-gradient)]`,
    headerAccent: `border-l-4 border-l-[var(--entity-${entity}-base)]`,
    tableTag: `border-[var(--entity-${entity}-border)] bg-[var(--entity-${entity}-bg)] text-[var(--entity-${entity}-fg)]`,
    typeaheadRow: `hover:bg-[var(--entity-${entity}-bg)] data-[selected=true]:bg-[var(--entity-${entity}-bg)]`,
  };
}

export function getSemanticToneClasses(tone: SemanticTone): CivicToneClasses {
  return SEMANTIC_TONE_CLASS_NAMES[tone];
}

export function getEntityToneClasses(
  entityType: EntityTone
): CivicEntityToneClasses | CivicToneClasses {
  if (entityType in PRIMARY_ENTITY_CLASS_NAMES) {
    return PRIMARY_ENTITY_CLASS_NAMES[entityType as PrimaryEntityTone];
  }

  return getSemanticToneClasses(SECONDARY_ENTITY_TO_SEMANTIC_TONE[entityType]);
}

export function getBadgeToneClasses(kind: BadgeToneKind): string {
  if (kind in SEMANTIC_TONE_CLASS_NAMES) {
    return getSemanticToneClasses(kind as SemanticTone).badge;
  }

  return getEntityToneClasses(kind as EntityTone).badge;
}

export function getTableTagToneClasses(kind: BadgeToneKind): string {
  if (kind in SEMANTIC_TONE_CLASS_NAMES) {
    return getSemanticToneClasses(kind as SemanticTone).tableTag;
  }

  return getEntityToneClasses(kind as EntityTone).tableTag;
}

export function getTypeaheadRowToneClasses(kind: BadgeToneKind): string {
  if (kind in SEMANTIC_TONE_CLASS_NAMES) {
    return getSemanticToneClasses(kind as SemanticTone).typeaheadRow;
  }

  return getEntityToneClasses(kind as EntityTone).typeaheadRow;
}

export function getValidationToneClasses(state: ValidationState): string {
  return VALIDATION_CLASS_NAMES[state];
}

export function getPlateSurfaceClasses(surface: PlateSurface): string {
  return PLATE_SURFACE_CLASS_NAMES[surface];
}

export function getMotionPreset(preset: MotionPreset): string {
  return MOTION_PRESET_CLASS_NAMES[preset];
}

export function isPrimaryEntityTone(entityType: EntityTone): entityType is PrimaryEntityTone {
  return entityType in PRIMARY_ENTITY_CLASS_NAMES;
}

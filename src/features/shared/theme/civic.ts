export type SemanticTone =
  'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'destructive' | 'accent' | 'outline';

export type PrimaryEntityTone = 'user' | 'group' | 'event' | 'amendment' | 'blog';

export type EntityTone = PrimaryEntityTone | 'agenda_item' | 'vote' | 'election' | 'todo' | 'role';

export type BadgeToneKind = SemanticTone | EntityTone;

export type CivicContentType =
  | 'group'
  | 'event'
  | 'meetup'
  | 'amendment'
  | 'agenda_item'
  | 'vote'
  | 'election'
  | 'video'
  | 'image'
  | 'statement'
  | 'todo'
  | 'blog'
  | 'payment'
  | 'action'
  | 'workflow'
  | 'user';

export type CivicRightType =
  | 'informationRight'
  | 'amendmentRight'
  | 'rightToSpeak'
  | 'activeVotingRight'
  | 'passiveVotingRight';

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
  | 'navigation'
  | 'spotlight'
  | 'selectable'
  | 'iconNudge'
  | 'successSettle'
  | 'ballotSubmit';

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
  user: {
    base: 'text-[var(--entity-user-base)]',
    badge:
      'border-[var(--entity-user-border)] bg-[var(--entity-user-bg)] text-[var(--entity-user-fg)]',
    dot: 'bg-[var(--entity-user-base)]',
    text: 'text-[var(--entity-user-fg)]',
    border: 'border-[var(--entity-user-border)]',
    surface:
      'border-[var(--entity-user-border)] bg-[var(--entity-user-bg)] text-[var(--entity-user-fg)]',
    softSurface: 'border-[var(--entity-user-border)] bg-[var(--entity-user-bg)]',
    ring: 'ring-[var(--entity-user-ring)]',
    gradient: 'border-[var(--entity-user-border)] bg-[var(--entity-user-bg)]',
    headerAccent: 'border-l-4 border-l-[var(--entity-user-base)]',
    tableTag:
      'border-[var(--entity-user-border)] bg-[var(--entity-user-bg)] text-[var(--entity-user-fg)]',
    typeaheadRow:
      'hover:bg-[var(--entity-user-bg)] data-[selected=true]:bg-[var(--entity-user-bg)]',
  },
  group: {
    base: 'text-[var(--entity-group-base)]',
    badge:
      'border-[var(--entity-group-border)] bg-[var(--entity-group-bg)] text-[var(--entity-group-fg)]',
    dot: 'bg-[var(--entity-group-base)]',
    text: 'text-[var(--entity-group-fg)]',
    border: 'border-[var(--entity-group-border)]',
    surface:
      'border-[var(--entity-group-border)] bg-[var(--entity-group-bg)] text-[var(--entity-group-fg)]',
    softSurface: 'border-[var(--entity-group-border)] bg-[var(--entity-group-bg)]',
    ring: 'ring-[var(--entity-group-ring)]',
    gradient: 'border-[var(--entity-group-border)] bg-[var(--entity-group-bg)]',
    headerAccent: 'border-l-4 border-l-[var(--entity-group-base)]',
    tableTag:
      'border-[var(--entity-group-border)] bg-[var(--entity-group-bg)] text-[var(--entity-group-fg)]',
    typeaheadRow:
      'hover:bg-[var(--entity-group-bg)] data-[selected=true]:bg-[var(--entity-group-bg)]',
  },
  event: {
    base: 'text-[var(--entity-event-base)]',
    badge:
      'border-[var(--entity-event-border)] bg-[var(--entity-event-bg)] text-[var(--entity-event-fg)]',
    dot: 'bg-[var(--entity-event-base)]',
    text: 'text-[var(--entity-event-fg)]',
    border: 'border-[var(--entity-event-border)]',
    surface:
      'border-[var(--entity-event-border)] bg-[var(--entity-event-bg)] text-[var(--entity-event-fg)]',
    softSurface: 'border-[var(--entity-event-border)] bg-[var(--entity-event-bg)]',
    ring: 'ring-[var(--entity-event-ring)]',
    gradient: 'border-[var(--entity-event-border)] bg-[var(--entity-event-bg)]',
    headerAccent: 'border-l-4 border-l-[var(--entity-event-base)]',
    tableTag:
      'border-[var(--entity-event-border)] bg-[var(--entity-event-bg)] text-[var(--entity-event-fg)]',
    typeaheadRow:
      'hover:bg-[var(--entity-event-bg)] data-[selected=true]:bg-[var(--entity-event-bg)]',
  },
  amendment: {
    base: 'text-[var(--entity-amendment-base)]',
    badge:
      'border-[var(--entity-amendment-border)] bg-[var(--entity-amendment-bg)] text-[var(--entity-amendment-fg)]',
    dot: 'bg-[var(--entity-amendment-base)]',
    text: 'text-[var(--entity-amendment-fg)]',
    border: 'border-[var(--entity-amendment-border)]',
    surface:
      'border-[var(--entity-amendment-border)] bg-[var(--entity-amendment-bg)] text-[var(--entity-amendment-fg)]',
    softSurface: 'border-[var(--entity-amendment-border)] bg-[var(--entity-amendment-bg)]',
    ring: 'ring-[var(--entity-amendment-ring)]',
    gradient: 'border-[var(--entity-amendment-border)] bg-[var(--entity-amendment-bg)]',
    headerAccent: 'border-l-4 border-l-[var(--entity-amendment-base)]',
    tableTag:
      'border-[var(--entity-amendment-border)] bg-[var(--entity-amendment-bg)] text-[var(--entity-amendment-fg)]',
    typeaheadRow:
      'hover:bg-[var(--entity-amendment-bg)] data-[selected=true]:bg-[var(--entity-amendment-bg)]',
  },
  blog: {
    base: 'text-[var(--entity-blog-base)]',
    badge:
      'border-[var(--entity-blog-border)] bg-[var(--entity-blog-bg)] text-[var(--entity-blog-fg)]',
    dot: 'bg-[var(--entity-blog-base)]',
    text: 'text-[var(--entity-blog-fg)]',
    border: 'border-[var(--entity-blog-border)]',
    surface:
      'border-[var(--entity-blog-border)] bg-[var(--entity-blog-bg)] text-[var(--entity-blog-fg)]',
    softSurface: 'border-[var(--entity-blog-border)] bg-[var(--entity-blog-bg)]',
    ring: 'ring-[var(--entity-blog-ring)]',
    gradient: 'border-[var(--entity-blog-border)] bg-[var(--entity-blog-bg)]',
    headerAccent: 'border-l-4 border-l-[var(--entity-blog-base)]',
    tableTag:
      'border-[var(--entity-blog-border)] bg-[var(--entity-blog-bg)] text-[var(--entity-blog-fg)]',
    typeaheadRow:
      'hover:bg-[var(--entity-blog-bg)] data-[selected=true]:bg-[var(--entity-blog-bg)]',
  },
};

const SECONDARY_ENTITY_TO_SEMANTIC_TONE = {
  agenda_item: 'info',
  vote: 'danger',
  election: 'accent',
  todo: 'success',
  role: 'neutral',
} as const satisfies Record<Exclude<EntityTone, PrimaryEntityTone>, SemanticTone>;

const CONTENT_TYPE_TO_TONE = {
  group: 'group',
  event: 'event',
  meetup: 'event',
  amendment: 'amendment',
  agenda_item: 'agenda_item',
  vote: 'vote',
  election: 'election',
  video: 'accent',
  image: 'info',
  statement: 'accent',
  todo: 'todo',
  blog: 'blog',
  payment: 'success',
  action: 'neutral',
  workflow: 'accent',
  user: 'user',
} as const satisfies Record<CivicContentType, BadgeToneKind>;

const SEMANTIC_SURFACE_CLASS_NAMES: Record<SemanticTone, string> = {
  neutral: 'border-[var(--badge-neutral-border)] bg-[var(--badge-neutral-bg)]',
  info: 'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)]',
  success: 'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)]',
  warning: 'border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)]',
  danger: 'border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)]',
  destructive: 'border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)]',
  accent: 'border-[var(--badge-accent-border)] bg-[var(--badge-accent-bg)]',
  outline: 'border-border bg-background',
};

const RIGHT_TYPE_TO_TONE = {
  informationRight: 'info',
  amendmentRight: 'amendment',
  rightToSpeak: 'accent',
  activeVotingRight: 'vote',
  passiveVotingRight: 'neutral',
} as const satisfies Record<CivicRightType, BadgeToneKind>;

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
  spotlight: 'civic-motion-spotlight',
  selectable: 'civic-motion-selectable',
  iconNudge: 'civic-icon-nudge',
  successSettle: 'civic-success-settle',
  ballotSubmit: 'civic-ballot-submit',
};

export function getSemanticToneClasses(tone: SemanticTone): CivicToneClasses {
  return SEMANTIC_TONE_CLASS_NAMES[tone];
}

export function getEntityToneClasses(entityType: PrimaryEntityTone): CivicEntityToneClasses;
export function getEntityToneClasses(
  entityType: Exclude<EntityTone, PrimaryEntityTone>
): CivicToneClasses;
export function getEntityToneClasses(
  entityType: EntityTone
): CivicEntityToneClasses | CivicToneClasses;
export function getEntityToneClasses(
  entityType: EntityTone
): CivicEntityToneClasses | CivicToneClasses {
  if (isPrimaryEntityTone(entityType)) {
    return PRIMARY_ENTITY_CLASS_NAMES[entityType];
  }

  return getSemanticToneClasses(SECONDARY_ENTITY_TO_SEMANTIC_TONE[entityType]);
}

export function getContentTypeToneClasses(
  contentType: CivicContentType
): CivicEntityToneClasses | CivicToneClasses {
  return getToneClasses(CONTENT_TYPE_TO_TONE[contentType]);
}

export function getEntityGradientClasses(
  entityType: CivicContentType | EntityTone | SemanticTone
): string {
  const tone = resolveToneKind(entityType);

  if (isPrimaryEntityTone(tone)) {
    return PRIMARY_ENTITY_CLASS_NAMES[tone].gradient;
  }

  if (isSemanticTone(tone)) {
    return SEMANTIC_SURFACE_CLASS_NAMES[tone];
  }

  return SEMANTIC_SURFACE_CLASS_NAMES[SECONDARY_ENTITY_TO_SEMANTIC_TONE[tone]];
}

export function getRoleToneClasses(): CivicToneClasses {
  return getSemanticToneClasses('neutral');
}

export function getHashtagToneClasses(): CivicToneClasses {
  return getSemanticToneClasses('accent');
}

export function getRightToneClasses(
  rightType: CivicRightType | string
): CivicEntityToneClasses | CivicToneClasses {
  return getToneClasses(RIGHT_TYPE_TO_TONE[rightType as CivicRightType] ?? 'neutral');
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

export function isPrimaryEntityTone(entityType: BadgeToneKind): entityType is PrimaryEntityTone {
  return entityType in PRIMARY_ENTITY_CLASS_NAMES;
}

function isSemanticTone(tone: BadgeToneKind): tone is SemanticTone {
  return tone in SEMANTIC_TONE_CLASS_NAMES;
}

function getToneClasses(kind: BadgeToneKind): CivicEntityToneClasses | CivicToneClasses {
  if (kind in SEMANTIC_TONE_CLASS_NAMES) {
    return getSemanticToneClasses(kind as SemanticTone);
  }

  return getEntityToneClasses(kind as EntityTone);
}

function resolveToneKind(contentType: CivicContentType | EntityTone | SemanticTone): BadgeToneKind {
  if (contentType in CONTENT_TYPE_TO_TONE) {
    return CONTENT_TYPE_TO_TONE[contentType as CivicContentType];
  }

  return contentType as BadgeToneKind;
}

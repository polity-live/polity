export type CreateVisibility = 'public' | 'authenticated' | 'private';

const CREATE_VISIBILITY_LABEL_KEYS = {
  public: 'pages.create.common.public',
  authenticated: 'pages.create.common.authenticated',
  private: 'pages.create.common.private',
} as const satisfies Record<CreateVisibility, string>;

export type CreateVisibilityLabelKey = (typeof CREATE_VISIBILITY_LABEL_KEYS)[CreateVisibility];

export function getCreateVisibilityLabelKey(
  visibility: CreateVisibility
): CreateVisibilityLabelKey {
  return CREATE_VISIBILITY_LABEL_KEYS[visibility];
}

import type { KeyboardEvent } from 'react';

/** Local to the focused list; editing controls and global navigation keep their keys. */
export function handleWorkspaceListKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
    return;
  const target = event.target as HTMLElement;
  if (
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="menu"]'
    )
  )
    return;
  if (!target.matches('[data-workspace-open]')) return;
  const row = target.closest('[data-workspace-row]');
  const preview = row?.querySelector<HTMLButtonElement>('[data-workspace-preview-button]');
  if (event.key === ' ' && preview) {
    event.preventDefault();
    event.stopPropagation();
    preview.click();
    return;
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const links = Array.from(
    (target.closest('[data-workspace-list]') ?? event.currentTarget).querySelectorAll<HTMLElement>(
      '[data-workspace-open]'
    )
  );
  const index = links.indexOf(target);
  const next = links[index + (event.key === 'ArrowDown' ? 1 : -1)];
  event.preventDefault();
  event.stopPropagation();
  next?.focus();
}

/** Reveal the invalid section without unmounting its controls or losing their state. */
export function focusCreateSection(root: HTMLElement | null, index: number) {
  const section = root?.querySelectorAll<HTMLElement>('[data-create-section]')[index];
  if (!section) return;
  section.querySelectorAll('details').forEach(details => {
    details.open = true;
  });
  root?.dispatchEvent(new Event('create:validate'));
  requestAnimationFrame(() => {
    const invalid = section.querySelector<HTMLElement>(
      '[aria-invalid="true"], :invalid, [data-create-invalid="true"] input, [data-create-invalid="true"] button'
    );
    const invalidControl = invalid?.matches('input,textarea,select,button,[tabindex]')
      ? invalid
      : invalid?.querySelector<HTMLElement>('input,textarea,select,button,[tabindex]');
    const target =
      invalidControl ??
      section.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]'
      );
    target?.focus({ preventScroll: true });
    (target ?? section).scrollIntoView({ block: 'center', behavior: 'auto' });
  });
}

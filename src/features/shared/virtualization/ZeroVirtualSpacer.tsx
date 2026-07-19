interface ZeroVirtualSpacerProps {
  position: 'before' | 'after';
  size: number;
}

/** Content spacer used by zero-virtual so native scroll anchoring sees extent changes. */
export function ZeroVirtualSpacer({ position, size }: ZeroVirtualSpacerProps) {
  if (size <= 0) return null;

  return (
    <div
      aria-hidden="true"
      data-zero-virtual-spacer={position}
      style={{ height: size, marginTop: 0, flexShrink: 0 }}
    />
  );
}

import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';

type PolityLocalVirtualizerOptions<
  TScrollElement extends Element,
  TItemElement extends Element,
> = Parameters<typeof useVirtualizer<TScrollElement, TItemElement>>[0];

/**
 * Shared fallback for derived or interactive collections that cannot be
 * represented as one cursor-paged Zero query.
 */
export function usePolityLocalVirtualizer<
  TScrollElement extends Element,
  TItemElement extends Element,
>(
  options: PolityLocalVirtualizerOptions<TScrollElement, TItemElement>
): Virtualizer<TScrollElement, TItemElement> {
  return useVirtualizer(options);
}

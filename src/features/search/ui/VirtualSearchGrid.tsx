import { useVirtualSearchGridController } from '../hooks/useVirtualSearchGridController';
import type { SearchListContext } from '../types/search-document.types';
import { VirtualSearchGridView } from './VirtualSearchGridView';

interface VirtualSearchGridProps {
  compact?: boolean;
  context: SearchListContext;
  permalinkID?: string | null;
  onTotalChange?: (total: number | null) => void;
}

export function VirtualSearchGrid({
  context,
  permalinkID,
  onTotalChange,
  compact,
}: VirtualSearchGridProps) {
  const controller = useVirtualSearchGridController({
    context,
    permalinkID,
    onTotalChange,
    compact,
  });

  return <VirtualSearchGridView {...controller} />;
}

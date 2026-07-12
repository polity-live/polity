import { useVirtualSearchGridController } from '../hooks/useVirtualSearchGridController';
import type { SearchListContext } from '../types/search-document.types';
import { VirtualSearchGridView } from './VirtualSearchGridView';

interface VirtualSearchGridProps {
  context: SearchListContext;
  permalinkID?: string | null;
  onTotalChange?: (total: number | null) => void;
}

export function VirtualSearchGrid({ context, permalinkID, onTotalChange }: VirtualSearchGridProps) {
  const controller = useVirtualSearchGridController({ context, permalinkID, onTotalChange });

  return <VirtualSearchGridView {...controller} />;
}

import { useState } from 'react';

export function useAsButtonNavigationController() {
  const [isExpanded, setIsExpanded] = useState(false);

  return {
    isExpanded,
    onExpand: () => setIsExpanded(true),
    onCollapse: () => setIsExpanded(false),
    onToggleExpanded: () => setIsExpanded(expanded => !expanded),
  };
}

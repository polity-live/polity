export interface GroupTypeFlagSource {
  group_type?: string | null;
  has_hierarchy_children?: boolean | null;
  has_sibling_connections?: boolean | null;
}

export function getGroupTypeFlags(group: GroupTypeFlagSource | null | undefined) {
  const groupType = group?.group_type ?? 'base';
  const isHierarchical = groupType === 'hierarchical' || group?.has_hierarchy_children === true;
  const isSibling = groupType === 'sibling' || group?.has_sibling_connections === true;
  const isBase = groupType === 'base' && !isHierarchical;

  return {
    isBase,
    isHierarchical,
    isSibling,
    isMixed: isHierarchical && isSibling,
  };
}

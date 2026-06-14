import type { TCommentText } from 'platejs';
import type { PlateLeafProps } from 'platejs/react';

import { getCommentCount } from '@platejs/comment';
import { useEditorPlugin, usePluginOption } from 'platejs/react';

import { commentPlugin } from '@/features/shared/ui/kit-platejs/comment-kit.tsx';
import { CommentLeafView } from './CommentLeafView';
export function CommentLeaf(props: PlateLeafProps<TCommentText>) {
  const { children, leaf } = props;

  const { api, setOption } = useEditorPlugin(commentPlugin);
  const hoverId = usePluginOption(commentPlugin, 'hoverId');
  const activeId = usePluginOption(commentPlugin, 'activeId');

  const isOverlapping = getCommentCount(leaf) > 1;
  const currentId = api.comment.nodeId(leaf);
  const isActive = activeId === currentId;
  const isHover = hoverId === currentId;
  return (
    <CommentLeafView
      props={props}
      children={children}
      leaf={leaf}
      api={api}
      setOption={setOption}
      hoverId={hoverId}
      activeId={activeId}
      isOverlapping={isOverlapping}
      currentId={currentId}
      isActive={isActive}
      isHover={isHover}
    />
  );
}

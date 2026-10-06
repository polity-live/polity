import { getCityDesignOsmFeatures } from '@/features/amendments/city-design/logic/cityDesignOsm';
import { zql } from '@/zero/schema';
import type { CityDesignStateV1 } from '@/features/amendments/city-design/types';
import type { ZeroTransaction } from '@/server/zero-mutate';
import { sqlTransaction } from '@/server/transaction';
import { resolveStudioSource } from '@/server/studio/source';
import { loadResource, requireProjectConversation } from './context';
import { ProjectToolError, type EditorContext } from '@/features/project-chat/logic/contracts';
import type { ProjectContextReference } from '@/features/project-chat/logic/context-references';

export async function validateEditorContext(
  tx: ZeroTransaction,
  actor: string,
  conversationId: string,
  input: EditorContext
): Promise<EditorContext> {
  const hints = structuredClone(input);
  const conversation = await requireProjectConversation(tx, actor, conversationId);
  if (conversation.studio_project_id) {
    if (hints.surface !== 'studio') throw new ProjectToolError('scope_mismatch');
    const source = await resolveStudioSource(
      actor,
      conversation.studio_project_id,
      hints.proposalId ?? null,
      sqlTransaction(tx)
    );
    const nodes = new Map(source.document.nodes.map(node => [node.id, node]));
    const refs: ProjectContextReference[] = [
      {
        kind: 'studio_project',
        id: source.projectId,
        label: source.document.title,
        origin: 'automatic',
      },
      {
        kind: 'workspace',
        id: source.workspaceId ?? 'canonical',
        workspaceId: source.workspaceId,
        label: source.proposal?.title ?? 'canonical',
        origin: 'automatic',
      },
    ];
    const selected: ProjectContextReference[] = hints.references?.filter(ref =>
      ['frame', 'element'].includes(ref.kind)
    ) ?? [
      ...(hints.pageId
        ? [{ kind: 'frame' as const, id: hints.pageId, label: '', origin: 'automatic' as const }]
        : []),
      ...(hints.elementIds ?? []).map(id => ({
        kind: 'element' as const,
        id,
        label: '',
        origin: 'automatic' as const,
      })),
    ];
    for (const ref of selected) {
      if (ref.workspaceId !== undefined && ref.workspaceId !== source.workspaceId)
        throw new ProjectToolError(
          'context_stale',
          'The workspace changed. Choose the context again.',
          'read_again'
        );
      const node = nodes.get(ref.id);
      if (!node || (ref.kind === 'frame') !== (node.type === 'frame'))
        throw new ProjectToolError(
          'invalid_target',
          'The context element or frame no longer exists.',
          'read_again'
        );
      refs.push({
        ...ref,
        workspaceId: source.workspaceId,
        label: node.name || node.type,
        parentId: node.parentFrameId ?? undefined,
      });
    }
    hints.proposalId = source.workspaceId;
    hints.references = refs;
    hints.pageId = selected.find(ref => ref.kind === 'frame')?.id;
    hints.elementIds = selected.filter(ref => ref.kind === 'element').map(ref => ref.id);
    hints.contentRevision = source.contentRevision;
    return hints;
  }
  if (hints.surface === 'studio') throw new ProjectToolError('scope_mismatch');
  const resource = await loadResource(tx, actor, conversationId, hints.surface, hints);
  const refs: ProjectContextReference[] = [
    {
      kind: 'amendment',
      id: conversation.amendment_id ?? '',
      label: resource.amendment?.title ?? 'Amendment',
      origin: 'automatic',
    },
  ];
  const branch = resource.branchId
    ? await tx.run(zql.amendment_process_branch.where('id', resource.branchId).one())
    : null;
  if (resource.branchId)
    refs.push({
      kind: 'branch',
      id: resource.branchId,
      branchId: resource.branchId,
      label: branch?.title ?? resource.branchId,
      origin: 'automatic',
    });
  if (hints.surface === 'amendment_text') {
    if (hints.selection && hints.contentRevision !== resource.contentRevision)
      throw new ProjectToolError(
        'context_stale',
        'The selected text changed. Select it again.',
        'read_again'
      );
    if (hints.selection)
      refs.push({
        kind: 'text_selection',
        id: resource.id,
        label: 'selection',
        origin: 'automatic',
      });
  } else {
    const scene = resource.value as {
      objects: { id: string; name?: string; type: string }[];
      osmSnapshot?: unknown;
    };
    refs.push({ kind: 'city_design', id: resource.id, label: 'City Design', origin: 'automatic' });
    for (const id of hints.objectIds ?? []) {
      const object = scene.objects.find(object => object.id === id);
      if (!object)
        throw new ProjectToolError(
          'invalid_target',
          'The selected city object no longer exists.',
          'read_again'
        );
      refs.push({
        kind: 'city_object',
        id,
        label: object.name || object.type,
        origin: 'automatic',
      });
    }
    const features = getCityDesignOsmFeatures((resource.value as CityDesignStateV1).osmSnapshot);
    for (const id of hints.featureIds ?? []) {
      const feature = features.find(feature => feature.id === id);
      if (!feature)
        throw new ProjectToolError(
          'invalid_target',
          'The selected map feature no longer exists.',
          'read_again'
        );
      refs.push({
        kind: 'city_feature',
        id,
        label: feature.label || feature.kind,
        origin: 'automatic',
      });
    }
  }
  hints.references = refs;
  return hints;
}

import { useEffect, useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { EditorView } from '@/features/editor/ui/EditorView';
import { useAuth } from '@/providers/auth-provider';
import { useUserState } from '@/zero/users/useUserState';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { AmendmentBranchSelectorSection } from '@/features/amendments/ui/AmendmentBranchSelectorSection';
import {
  READONLY_BRANCH_RESOLUTIONS,
  TERMINAL_BRANCH_STATUSES,
  buildBranchDiffCandidates,
  getBranchDisplayEvent,
  getBranchPathLabel,
  getLatestBranchWithContent,
  getWinnerBranch,
  resolveSelectedBranchId,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import { MessageSquareWarning } from 'lucide-react';

const amendmentTextSearchSchema = z.object({
  branch: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/_authed/amendment/$id/text')({
  validateSearch: search => amendmentTextSearchSchema.parse(search),
  component: AmendmentTextPage,
});

function AmendmentTextPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { user: userRecord } = useUserState({ userId: user?.id });
  const { amendment, amendmentProcess, documents } = useAmendmentState({
    amendmentId: id,
    includeProcessData: true,
    includeDocuments: true,
  });

  const currentRun = amendmentProcess?.current_process_run;
  const branches = useMemo(() => currentRun?.branches ?? [], [currentRun?.branches]);
  const activeBranchId = currentRun?.active_branch_id ?? null;

  const selectedBranchId = useMemo(
    () =>
      resolveSelectedBranchId({
        branches,
        requestedBranchId: search.branch,
        activeBranchId,
      }),
    [activeBranchId, branches, search.branch]
  );

  useEffect(() => {
    if (branches.length === 0) return;
    if ((search.branch ?? null) === selectedBranchId) return;

    navigate({
      to: '/amendment/$id/text',
      params: { id },
      search: { branch: selectedBranchId ?? undefined },
      replace: true,
    });
  }, [branches.length, id, navigate, search.branch, selectedBranchId]);

  const selectedBranch = useMemo(
    () => branches.find(branch => branch.id === selectedBranchId) ?? null,
    [branches, selectedBranchId]
  );
  const selectedBranchMergeTarget = selectedBranch?.merged_into_branch_id
    ? (branches.find(branch => branch.id === selectedBranch.merged_into_branch_id) ??
      selectedBranch.merged_into_branch ??
      null)
    : null;
  const showRejectedBranchNotice =
    Boolean(selectedBranchMergeTarget) &&
    (TERMINAL_BRANCH_STATUSES.has(selectedBranch?.status ?? '') ||
      READONLY_BRANCH_RESOLUTIONS.has(selectedBranch?.resolution ?? ''));

  const branchDiffCandidates = useMemo(() => {
    const originalDocument =
      documents.find(document => document.id === amendment?.document_id) ?? documents[0] ?? null;
    return buildBranchDiffCandidates({
      branches,
      originalContent: originalDocument?.content ?? null,
      activeBranchId,
    });
  }, [activeBranchId, amendment?.document_id, branches, documents]);
  const defaultDiffRightBranch =
    getWinnerBranch(branches, activeBranchId) ?? getLatestBranchWithContent(branches);

  const selectedBranchEvent = selectedBranch ? getBranchDisplayEvent(selectedBranch) : null;
  const agendaItemId =
    selectedBranchEvent?.agenda_item_id ?? amendmentProcess?.agenda_items?.[0]?.id;

  const mappedUserRecord = userRecord
    ? {
        id: userRecord.id,
        name: `${userRecord.first_name ?? ''} ${userRecord.last_name ?? ''}`.trim() || undefined,
        email: userRecord.email ?? undefined,
        avatar: userRecord.avatar ?? undefined,
      }
    : undefined;

  return (
    <div className="space-y-2 pt-5">
      {branches.length > 0 ? (
        <AmendmentBranchSelectorSection
          branches={branches}
          selectedBranchId={selectedBranchId}
          branchDiffCandidates={branchDiffCandidates}
          defaultDiffRightCandidateId={defaultDiffRightBranch?.id ?? null}
          onBranchChange={branchId =>
            navigate({
              to: '/amendment/$id/text',
              params: { id },
              search: { branch: branchId ?? undefined },
            })
          }
        />
      ) : null}

      {showRejectedBranchNotice && selectedBranchMergeTarget ? (
        <div className="border-border bg-muted/30 mx-auto flex w-full max-w-5xl items-start gap-2 border px-4 py-3 text-sm">
          <MessageSquareWarning className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">
              Rejected in favor of {getBranchPathLabel(selectedBranchMergeTarget)}
            </p>
            <p className="text-muted-foreground">
              Diese Textvariante ist abgeschlossen und bleibt im Editor schreibgeschützt.
            </p>
          </div>
        </div>
      ) : null}

      <EditorView
        entityType="amendment"
        entityId={id}
        userId={user?.id}
        userRecord={mappedUserRecord}
        agendaItemId={agendaItemId}
        processBranchId={selectedBranchId}
        compactToolbarSpacing
        backUrl={`/amendment/${id}/process`}
      />
    </div>
  );
}

import { FileText } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { PqlToolbar } from '@/features/pql/ui/PqlToolbar';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

import { CreateDocumentDialog } from './CreateDocumentDialog';
import { GroupDocumentCard } from './GroupDocumentCard';
import type { GroupDocumentsListModel } from '../hooks/useGroupDocumentsList';
import { PolityZeroGridView } from '@/features/shared/virtualization';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { queries } from '@/zero/queries';

interface VirtualGroupDocument {
  id: string;
  created_at: number;
  updated_at: number;
  amendment?: { title?: string | null } | null;
  collaborators?: readonly {
    id: string;
    user?: { id: string } | null;
  }[];
}

function CreateAction({
  canManageDocuments,
  groupId,
  groupName,
  isCreating,
  onCreateDocument,
}: Pick<
  GroupDocumentsListModel,
  'canManageDocuments' | 'groupId' | 'groupName' | 'isCreating' | 'onCreateDocument'
>) {
  if (!canManageDocuments) {
    return null;
  }

  return (
    <CreateDocumentDialog
      groupId={groupId}
      groupName={groupName}
      onCreateDocument={onCreateDocument}
      isCreating={isCreating}
    />
  );
}

function DocumentsEmptyState({
  canManageDocuments,
  hasActiveFilters,
}: {
  canManageDocuments: boolean;
  hasActiveFilters: boolean;
}) {
  return (
    <Card>
      <CardContent align="center" className="flex flex-col items-center justify-center py-20">
        <FileText className="text-muted-foreground mb-4 h-16 w-16" />
        <p className="text-muted-foreground mb-2 text-lg">
          {hasActiveFilters
            ? translateText(
                'generated.inline.0062_no_documents_match_the_current_search_and_fil_9fe5ffdc'
              )
            : canManageDocuments
              ? translateText(
                  'generated.inline.0060_no_documents_yet_create_your_first_document_t_bb860ef3'
                )
              : translateText('generated.inline.0061_no_documents_available_yet_02bcc505')}
        </p>
      </CardContent>
    </Card>
  );
}

function VirtualGroupDocumentsGrid({
  groupId,
  query,
  canManageDocuments,
}: {
  groupId: string;
  query: string;
  canManageDocuments: boolean;
}) {
  const context = useMemo(() => ({ groupId, query: query.trim() }), [groupId, query]);
  const getPageQuery = useCallback(
    ({ limit, start, dir, settled }: any) => ({
      query: queries.documents.pageByGroup({ ...context, limit, start, dir }) as any,
      options: { ttl: settled ? ('5m' as const) : ('none' as const) },
    }),
    [context]
  );
  const getSingleQuery = useCallback(
    ({ id, settled }: any) => ({
      query: queries.documents.byId({ id }) as any,
      options: { ttl: settled ? ('5m' as const) : ('none' as const) },
    }),
    []
  );

  return (
    <PolityZeroGridView<VirtualGroupDocument, { updated_at: number; id: string }, typeof context>
      context={context}
      historyKey={`group-${groupId}-documents`}
      estimateSize={190}
      getLanes={width => (width >= 1024 ? 3 : width >= 640 ? 2 : 1)}
      getRowKey={document => document.id}
      toStartRow={document => ({ updated_at: document.updated_at, id: document.id })}
      getPageQuery={getPageQuery}
      getSingleQuery={getSingleQuery}
      renderRow={document => (
        <GroupDocumentCard
          document={{ ...document, title: document.amendment?.title }}
          href={`/group/${groupId}/editor/${document.id}`}
        />
      )}
      renderSkeleton={() => <Skeleton className="h-40 w-full rounded-xl" />}
      renderEmpty={() => (
        <DocumentsEmptyState
          canManageDocuments={canManageDocuments}
          hasActiveFilters={Boolean(query)}
        />
      )}
    />
  );
}

export function GroupDocumentsListView({
  canManageDocuments,
  documents,
  fields,
  groupId,
  groupName,
  isCreating,
  isLoading,
  onCreateDocument,
  pql,
}: GroupDocumentsListModel) {
  if (isLoading) {
    return <SectionSkeleton rows={4} />;
  }

  if (documents.length === 0) {
    return (
      <>
        {canManageDocuments ? (
          <div className="mb-6">
            <CreateAction
              canManageDocuments={canManageDocuments}
              groupId={groupId}
              groupName={groupName}
              isCreating={isCreating}
              onCreateDocument={onCreateDocument}
            />
          </div>
        ) : null}
        <Card>
          <CardContent align="center" className="flex flex-col items-center justify-center py-20">
            <FileText className="text-muted-foreground mb-4 h-16 w-16" />
            <p className="text-muted-foreground mb-4 text-lg">
              {canManageDocuments
                ? translateText(
                    'generated.inline.0060_no_documents_yet_create_your_first_document_t_bb860ef3'
                  )
                : translateText('generated.inline.0061_no_documents_available_yet_02bcc505')}
            </p>
            <CreateAction
              canManageDocuments={canManageDocuments}
              groupId={groupId}
              groupName={groupName}
              isCreating={isCreating}
              onCreateDocument={onCreateDocument}
            />
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PqlToolbar
        fields={fields}
        searchQuery={pql.searchQuery}
        onSearchQueryChange={pql.setSearchQuery}
        searchPlaceholder={translateText(
          'generated.inline.0414_search_documents_and_collaborators_20b3fc11'
        )}
        quickFilters={[]}
        quickFilterValues={pql.quickFilterValues}
        onQuickFilterValuesChange={pql.setQuickFilterValues}
        onQuickFilterToggle={pql.toggleQuickFilterValue}
        onQuickFilterClear={pql.clearQuickFilter}
        savedFilters={pql.savedFilters}
        activeCustomFilterIds={pql.activeCustomFilterIds}
        onCustomFilterToggle={pql.toggleCustomFilter}
        onCustomFilterDelete={pql.deleteCustomFilter}
        onCustomFilterSave={pql.saveCustomFilter}
        actions={
          canManageDocuments ? (
            <CreateAction
              canManageDocuments={canManageDocuments}
              groupId={groupId}
              groupName={groupName}
              isCreating={isCreating}
              onCreateDocument={onCreateDocument}
            />
          ) : undefined
        }
      />

      {pql.filteredItems.length === 0 ? (
        <DocumentsEmptyState
          canManageDocuments={canManageDocuments}
          hasActiveFilters={pql.hasActiveFilters}
        />
      ) : pql.activeCustomFilterIds.length === 0 ? (
        <VirtualGroupDocumentsGrid
          groupId={groupId}
          query={pql.searchQuery}
          canManageDocuments={canManageDocuments}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pql.filteredItems.map((document: any) => (
            <GroupDocumentCard
              key={document.id}
              document={document}
              href={`/group/${groupId}/editor/${document.id}`}
            />
          ))}
        </div>
      )}
    </>
  );
}

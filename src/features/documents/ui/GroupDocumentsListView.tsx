import { FileText, Loader2 } from 'lucide-react';

import { PqlToolbar } from '@/features/pql/ui/PqlToolbar';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

import { CreateDocumentDialog } from './CreateDocumentDialog';
import { GroupDocumentCard } from './GroupDocumentCard';
import type { GroupDocumentsListModel } from '../hooks/useGroupDocumentsList';

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
      <CardContent className="flex flex-col items-center justify-center py-20 text-center">
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
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
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
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
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
      {canManageDocuments ? (
        <div className="mb-6 flex justify-between">
          <CreateAction
            canManageDocuments={canManageDocuments}
            groupId={groupId}
            groupName={groupName}
            isCreating={isCreating}
            onCreateDocument={onCreateDocument}
          />
        </div>
      ) : null}

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
      />

      {pql.filteredItems.length === 0 ? (
        <DocumentsEmptyState
          canManageDocuments={canManageDocuments}
          hasActiveFilters={pql.hasActiveFilters}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pql.filteredItems.map(document => (
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

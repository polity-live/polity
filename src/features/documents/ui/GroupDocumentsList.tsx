/**
 * Group Documents List Component
 *
 * Displays a list of documents for a group with create functionality.
 */

import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { PqlToolbar } from '@/features/pql/ui/PqlToolbar';
import { usePqlCollection } from '@/features/pql/hooks/usePqlCollection';
import type { PqlFieldDefinition } from '@/features/pql/logic/applyPqlFilter';
import { Loader2, FileText } from 'lucide-react';
import { useGroupDocuments } from '../hooks/useGroupDocuments';
import { useDocumentMutations } from '../hooks/useDocumentMutations';
import { GroupDocumentCard } from './GroupDocumentCard';
import { CreateDocumentDialog } from './CreateDocumentDialog';

interface GroupDocumentsListProps {
  groupId: string;
  groupName?: string;
  userId?: string;
  storageKey?: string;
}

type GroupDocumentItem = ReturnType<typeof useGroupDocuments>['documents'][number];

type DocumentFieldKey = 'title' | 'collaborator_keys' | 'updated_at' | 'created_at';

function getCollaboratorLabel(
  user: GroupDocumentItem['collaborators'][number]['user']
): string | null {
  if (!user?.id) {
    return null;
  }

  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.handle ||
    user.email ||
    user.id
  );
}

function sortDocuments(items: GroupDocumentItem[]): GroupDocumentItem[] {
  return [...items].sort(
    (leftDocument, rightDocument) => rightDocument.updated_at - leftDocument.updated_at
  );
}

export function GroupDocumentsList({
  groupId,
  groupName,
  userId,
  storageKey = `group-${groupId}-documents`,
}: GroupDocumentsListProps) {
  const navigate = useNavigate();
  const { documents, isLoading } = useGroupDocuments(groupId);
  const { createDocument, isCreating } = useDocumentMutations(groupId);

  const collaboratorOptions = useMemo(() => {
    const nextOptions = new Map<string, { value: string; label: string; keywords: string[] }>();

    for (const document of documents) {
      for (const collaborator of document.collaborators ?? []) {
        const user = collaborator.user;
        if (!user?.id) {
          continue;
        }

        nextOptions.set(user.id, {
          value: user.id,
          label: getCollaboratorLabel(user) ?? user.id,
          keywords: [user.handle ?? '', user.email ?? ''].filter(Boolean),
        });
      }
    }

    return [...nextOptions.values()].sort((leftOption, rightOption) =>
      leftOption.label.localeCompare(rightOption.label)
    );
  }, [documents]);

  const fields = useMemo<readonly PqlFieldDefinition<GroupDocumentItem, DocumentFieldKey>[]>(
    () => [
      {
        key: 'title',
        label: 'Title',
        kind: 'text',
        operators: ['contains', 'eq'],
        getValue: document => document.title,
      },
      {
        key: 'collaborator_keys',
        label: 'Collaborator',
        kind: 'entity',
        operators: ['in'],
        options: collaboratorOptions,
        getValue: document =>
          document.collaborators
            ?.map(collaborator => collaborator.user?.id)
            .filter((value): value is string => Boolean(value)) ?? [],
      },
      {
        key: 'updated_at',
        label: 'Updated',
        kind: 'date',
        operators: ['gt', 'gte', 'lt', 'lte'],
        getValue: document => document.updated_at,
      },
      {
        key: 'created_at',
        label: 'Created',
        kind: 'date',
        operators: ['gt', 'gte', 'lt', 'lte'],
        getValue: document => document.created_at,
      },
    ],
    [collaboratorOptions]
  );

  const {
    searchQuery,
    setSearchQuery,
    quickFilterValues,
    setQuickFilterValues,
    toggleQuickFilterValue,
    clearQuickFilter,
    savedFilters,
    saveCustomFilter,
    deleteCustomFilter,
    activeCustomFilterIds,
    toggleCustomFilter,
    filteredItems,
    hasActiveFilters,
  } = usePqlCollection({
    items: documents,
    fields,
    quickFilters: [],
    storageKey,
    searchValues: [
      document =>
        [
          document.title,
          ...(document.collaborators
            ?.map(collaborator => getCollaboratorLabel(collaborator.user))
            .filter((value): value is string => Boolean(value)) ?? []),
        ].filter((value): value is string => Boolean(value)),
    ],
    sortItems: sortDocuments,
  });

  const handleOpenDocument = (docId: string) => {
    navigate({ to: `/group/${groupId}/editor/${docId}` });
  };

  const handleCreateDocument = async (title: string) => {
    if (!userId) return;
    await createDocument(title, groupId, userId);
  };

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
        <div className="mb-6">
          <CreateDocumentDialog
            groupId={groupId}
            groupName={groupName}
            onCreateDocument={handleCreateDocument}
            isCreating={isCreating}
          />
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="text-muted-foreground mb-4 h-16 w-16" />
            <p className="text-muted-foreground mb-4 text-lg">
              No documents yet. Create your first document to get started.
            </p>
            <CreateDocumentDialog
              groupId={groupId}
              groupName={groupName}
              onCreateDocument={handleCreateDocument}
              isCreating={isCreating}
            />
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex justify-between">
        <CreateDocumentDialog
          groupId={groupId}
          groupName={groupName}
          onCreateDocument={handleCreateDocument}
          isCreating={isCreating}
        />
      </div>

      <PqlToolbar
        fields={fields}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchPlaceholder="Search documents and collaborators..."
        quickFilters={[]}
        quickFilterValues={quickFilterValues}
        onQuickFilterValuesChange={setQuickFilterValues}
        onQuickFilterToggle={toggleQuickFilterValue}
        onQuickFilterClear={clearQuickFilter}
        savedFilters={savedFilters}
        activeCustomFilterIds={activeCustomFilterIds}
        onCustomFilterToggle={toggleCustomFilter}
        onCustomFilterDelete={deleteCustomFilter}
        onCustomFilterSave={saveCustomFilter}
      />

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="text-muted-foreground mb-4 h-16 w-16" />
            <p className="text-muted-foreground mb-2 text-lg">
              {hasActiveFilters
                ? 'No documents match the current search and filters.'
                : 'No documents yet. Create your first document to get started.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map(doc => (
            <GroupDocumentCard
              key={doc.id}
              document={doc}
              userId={userId}
              onClick={() => handleOpenDocument(doc.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

import type { PqlFieldDefinition } from '@/features/pql/logic/applyPqlFilter';

export interface GroupDocumentUser {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  handle?: string | null;
  email?: string | null;
}

export interface GroupDocumentListItem {
  id: string;
  title?: string | null;
  updated_at: number;
  created_at: number;
  collaborators?:
    | readonly {
        user?: GroupDocumentUser | null;
      }[]
    | null;
}

export type DocumentFieldKey = 'title' | 'collaborator_keys' | 'updated_at' | 'created_at';

export interface DocumentFieldLabels {
  title: string;
  collaborator: string;
  updated: string;
  created: string;
}

export function getCollaboratorLabel(user: GroupDocumentUser | null | undefined): string | null {
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

export function buildCollaboratorOptions(documents: readonly GroupDocumentListItem[]) {
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
}

export function buildDocumentPqlFields<TDocument extends GroupDocumentListItem>(
  collaboratorOptions: ReturnType<typeof buildCollaboratorOptions>,
  labels: DocumentFieldLabels
): readonly PqlFieldDefinition<TDocument, DocumentFieldKey>[] {
  return [
    {
      key: 'title',
      label: labels.title,
      kind: 'text',
      operators: ['contains', 'eq'],
      getValue: document => document.title ?? '',
    },
    {
      key: 'collaborator_keys',
      label: labels.collaborator,
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
      label: labels.updated,
      kind: 'date',
      operators: ['gt', 'gte', 'lt', 'lte'],
      getValue: document => document.updated_at,
    },
    {
      key: 'created_at',
      label: labels.created,
      kind: 'date',
      operators: ['gt', 'gte', 'lt', 'lte'],
      getValue: document => document.created_at,
    },
  ];
}

export function getDocumentSearchValues(document: GroupDocumentListItem): string[] {
  return [
    document.title ?? '',
    ...(document.collaborators
      ?.map(collaborator => getCollaboratorLabel(collaborator.user))
      .filter((value): value is string => Boolean(value)) ?? []),
  ].filter((value): value is string => Boolean(value));
}

export function sortDocuments<TDocument extends GroupDocumentListItem>(
  items: readonly TDocument[]
): TDocument[] {
  return [...items].sort(
    (leftDocument, rightDocument) => rightDocument.updated_at - leftDocument.updated_at
  );
}

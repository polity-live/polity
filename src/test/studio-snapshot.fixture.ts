const cached = new WeakMap<object, { signature: string; values: Record<string, unknown> }>();
export function studioSnapshotFixture(
  query: { name: string } | undefined,
  io: { snapshot: any; user: { id: string } | null; queryStatus?: unknown }
) {
  const signature = JSON.stringify([io.snapshot, io.user]);
  let previous = cached.get(io);
  if (!previous || previous.signature !== signature) {
    const snapshot = io.snapshot;
    const project = snapshot?.project
      ? {
          ...snapshot.project,
          group_id: snapshot.project.groupId ?? null,
          owner_id: snapshot.project.ownerId ?? 'owner',
        }
      : undefined;
    previous = {
      signature,
      values: {
        project,
        document: snapshot ? { document: snapshot.document } : undefined,
        assets: (snapshot?.assets ?? []).map((a: any) => ({ ...a, mime_type: a.mime })),
        sessionProject: snapshot?.project?.canEdit
          ? { ...project, owner_id: io.user?.id }
          : undefined,
        manageGroups: [],
      },
    };
    cached.set(io, previous);
  }
  return [query ? previous.values[query.name] : undefined, io.queryStatus ?? { type: 'complete' }];
}

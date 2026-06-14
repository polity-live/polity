interface AgendaDelegateTargetNoticeProps {
  title: string;
  descriptionPrefix: string;
  targetTitle: string;
  descriptionSuffix: string;
  sourceGroupLabel?: string;
  sourceGroupName?: string | null;
}

export function AgendaDelegateTargetNotice({
  title,
  descriptionPrefix,
  targetTitle,
  descriptionSuffix,
  sourceGroupLabel,
  sourceGroupName,
}: AgendaDelegateTargetNoticeProps) {
  return (
    <div className="bg-muted/30 rounded-2xl border p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 text-sm">
        {descriptionPrefix} <strong>{targetTitle}</strong> {descriptionSuffix}
      </p>
      {sourceGroupName ? (
        <p className="text-muted-foreground mt-2 text-sm">
          {sourceGroupLabel}
          <strong>{sourceGroupName}</strong>
        </p>
      ) : null}
    </div>
  );
}

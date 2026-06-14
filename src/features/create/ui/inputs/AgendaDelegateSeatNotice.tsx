interface AgendaDelegateSeatNoticeProps {
  prefix: string;
  seatCount: number;
  seatLabel: string;
  suffix: string;
}

export function AgendaDelegateSeatNotice({
  prefix,
  seatCount,
  seatLabel,
  suffix,
}: AgendaDelegateSeatNoticeProps) {
  return (
    <div className="bg-muted/30 text-muted-foreground rounded-2xl border p-4 text-sm">
      {prefix}
      {seatCount} {seatLabel}
      {suffix}
    </div>
  );
}

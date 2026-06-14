import type { LucideIcon } from 'lucide-react';

export function ProductStoryPoint({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="bg-card flex gap-3 rounded-lg border p-4 shadow-sm">
      <div className="bg-brand/10 text-brand flex h-9 w-9 flex-none items-center justify-center rounded-md">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-muted-foreground text-sm leading-6">{text}</p>
    </div>
  );
}

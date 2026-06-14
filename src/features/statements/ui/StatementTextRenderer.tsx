import { MentionHashtagText } from '@/features/shared/ui/rich-text';

interface StatementTextRendererProps {
  text: string;
  className?: string;
}

export function StatementTextRenderer({ text, className }: StatementTextRendererProps) {
  return <MentionHashtagText text={text} className={className} />;
}

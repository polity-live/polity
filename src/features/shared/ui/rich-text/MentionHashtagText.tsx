import { Link } from '@tanstack/react-router';
import { tokenizeText } from '@/features/shared/logic/mentionHelpers';

interface MentionHashtagTextProps {
  className?: string;
  text: string;
}

export function MentionHashtagText({ className, text }: MentionHashtagTextProps) {
  const tokens = tokenizeText(text);

  return (
    <span className={className}>
      {tokens.map((token, index) => {
        if (token.type === 'mention') {
          return (
            <Link
              key={index}
              to="/search"
              search={{ q: token.value }}
              className="text-primary font-medium hover:underline"
            >
              @{token.value}
            </Link>
          );
        }

        if (token.type === 'hashtag') {
          return (
            <Link
              key={index}
              to="/search"
              search={{ hashtag: token.value }}
              className="text-primary font-medium hover:underline"
            >
              #{token.value}
            </Link>
          );
        }

        return <span key={index}>{token.value}</span>;
      })}
    </span>
  );
}

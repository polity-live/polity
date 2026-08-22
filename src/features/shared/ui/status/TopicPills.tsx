import { getSemanticToneClasses } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status/StatusBadges';
import { cn } from '@/features/shared/utils/utils';

export interface TopicPillProps {
  topic: string;
  variant?:
    'default' | 'climate' | 'urban' | 'transport' | 'budget' | 'education' | 'health' | 'housing';
  size?: 'sm' | 'md';
  className?: string;
  onClick?: () => void;
}

type TopicColorVariant = NonNullable<TopicPillProps['variant']>;

function getTopicColors(variant: TopicColorVariant) {
  const tone =
    variant === 'climate'
      ? 'success'
      : variant === 'urban' || variant === 'housing'
        ? 'info'
        : variant === 'transport' || variant === 'budget'
          ? 'warning'
          : variant === 'education'
            ? 'accent'
            : variant === 'health'
              ? 'danger'
              : 'neutral';

  const colors = getSemanticToneClasses(tone);
  return { bg: colors.surface, text: colors.text, border: colors.border };
}

function getTopicVariant(topic: string): TopicColorVariant {
  const normalizedTopic = topic.toLowerCase();

  if (
    normalizedTopic.includes('climate') ||
    normalizedTopic.includes('environment') ||
    normalizedTopic.includes('green')
  ) {
    return 'climate';
  }
  if (
    normalizedTopic.includes('urban') ||
    normalizedTopic.includes('city') ||
    normalizedTopic.includes('planning')
  ) {
    return 'urban';
  }
  if (
    normalizedTopic.includes('transport') ||
    normalizedTopic.includes('traffic') ||
    normalizedTopic.includes('mobility')
  ) {
    return 'transport';
  }
  if (
    normalizedTopic.includes('budget') ||
    normalizedTopic.includes('finance') ||
    normalizedTopic.includes('money')
  ) {
    return 'budget';
  }
  if (
    normalizedTopic.includes('education') ||
    normalizedTopic.includes('school') ||
    normalizedTopic.includes('learning')
  ) {
    return 'education';
  }
  if (
    normalizedTopic.includes('health') ||
    normalizedTopic.includes('medical') ||
    normalizedTopic.includes('care')
  ) {
    return 'health';
  }
  if (
    normalizedTopic.includes('housing') ||
    normalizedTopic.includes('home') ||
    normalizedTopic.includes('rent')
  ) {
    return 'housing';
  }

  return 'default';
}

export function TopicPill({ topic, variant, size = 'sm', className, onClick }: TopicPillProps) {
  const colorVariant = variant || getTopicVariant(topic);
  const colors = getTopicColors(colorVariant);

  return (
    <BadgeControl
      variant="outline"
      className={cn(
        'border font-medium transition-colors',
        colors.bg,
        colors.text,
        colors.border,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        onClick && 'cursor-pointer hover:opacity-80',
        className
      )}
      onClick={onClick}
    >
      {topic}
    </BadgeControl>
  );
}

export function TopicPillList({
  topics,
  maxDisplay = 3,
  size = 'sm',
  className,
}: {
  topics: string[];
  maxDisplay?: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const displayedTopics = topics.slice(0, maxDisplay);
  const remainingCount = topics.length - maxDisplay;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {displayedTopics.map((topic, index) => (
        <TopicPill key={`${topic}-${index}`} topic={topic} size={size} />
      ))}
      {remainingCount > 0 && (
        <BadgeControl
          variant="secondary"
          className={cn('font-medium', size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm')}
        >
          +{remainingCount}
        </BadgeControl>
      )}
    </div>
  );
}

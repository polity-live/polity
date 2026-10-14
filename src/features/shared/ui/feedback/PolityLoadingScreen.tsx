import { Landmark } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import './polity-loading.css';

export function PolityLoadingScreen({
  label,
  fullPage = false,
}: {
  label: string;
  fullPage?: boolean;
}) {
  return (
    <div
      className={cn('polity-presentation-loading', fullPage && 'polity-presentation-loading-page')}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="polity-presentation-loading-mark" aria-hidden="true">
        <svg className="polity-presentation-loading-ring" viewBox="0 0 100 100" fill="none">
          <circle className="polity-presentation-loading-track" cx="50" cy="50" r="46" />
          <circle className="polity-presentation-loading-arc" cx="50" cy="50" r="46" />
        </svg>
        <Landmark className="polity-presentation-loading-symbol" strokeWidth={1.4} />
      </div>
      <span className="polity-presentation-loading-brand" aria-hidden="true">
        Polity
      </span>
      <p className="polity-presentation-loading-label">{label}</p>
    </div>
  );
}

import { useAmendmentSearchCardController } from '../hooks/useAmendmentSearchCardController';
import { type SearchAmendment } from '../types/search.types';
import { AmendmentSearchCardView } from './AmendmentSearchCardView';

interface AmendmentSearchCardProps {
  amendment: SearchAmendment;
}

export function AmendmentSearchCard({ amendment }: AmendmentSearchCardProps) {
  return <AmendmentSearchCardView {...useAmendmentSearchCardController({ amendment })} />;
}

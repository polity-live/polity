import { createFileRoute } from '@tanstack/react-router';
import { useStatementDetailModel } from '@/features/statements/hooks/useStatementDetailModel';
import { StatementDetail } from '@/features/statements/ui/StatementDetail';

export const Route = createFileRoute('/_authed/statement/$id')({
  component: StatementPage,
});

function StatementPage() {
  const { id } = Route.useParams();
  const model = useStatementDetailModel({ statementId: id });

  return <StatementDetail model={model} />;
}

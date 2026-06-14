import { Calculator } from 'lucide-react';
import type { StreetDesignCostSummary } from '../types';
import { formatMinorCurrency } from '../logic/streetDesignCostCatalog';

interface StreetCostSummaryViewProps {
  summary: StreetDesignCostSummary;
}

const categoryLabels: Record<StreetDesignCostSummary['categories'][number]['category'], string> = {
  greenery: 'Gruen',
  mobility: 'Mobilitaet',
  street: 'Strasse',
  furniture: 'Moeblierung',
};

export function StreetCostSummaryView({ summary }: StreetCostSummaryViewProps) {
  return (
    <section className="border-border bg-background rounded-md border p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calculator className="text-muted-foreground size-4" />
          <h2 className="text-sm font-semibold">Kosten</h2>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{formatMinorCurrency(summary.totalCostMinor)}</p>
          <p className="text-muted-foreground text-xs">Schaetzung</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {summary.categories.map((category: StreetDesignCostSummary['categories'][number]) => (
          <div key={category.category} className="bg-muted/20 rounded-md border px-3 py-2">
            <p className="text-xs font-medium">{categoryLabels[category.category]}</p>
            <p className="text-sm font-semibold">
              {formatMinorCurrency(category.totalCostMinor, summary.currency)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 max-h-40 overflow-auto rounded-md border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground sticky top-0">
            <tr>
              <th className="px-3 py-2 font-medium">Element</th>
              <th className="px-3 py-2 font-medium">Menge</th>
              <th className="px-3 py-2 font-medium">Preis</th>
              <th className="px-3 py-2 text-right font-medium">Summe</th>
            </tr>
          </thead>
          <tbody>
            {summary.lines.length === 0 ? (
              <tr>
                <td className="text-muted-foreground px-3 py-3" colSpan={4}>
                  Noch keine Elemente.
                </td>
              </tr>
            ) : (
              summary.lines.map((line: any) => (
                <tr key={line.objectId} className="border-t">
                  <td className="px-3 py-2">{line.label}</td>
                  <td className="px-3 py-2">{line.quantity.toFixed(line.quantity % 1 ? 1 : 0)}</td>
                  <td className="px-3 py-2">
                    {formatMinorCurrency(line.unitCostMinor, summary.currency)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatMinorCurrency(line.totalCostMinor, summary.currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { useState, type Dispatch, type SetStateAction } from 'react';
import { PlusIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import type { DatasetSearchFilters, DatasetSearchIntent } from '../types';

export function DatasetSearchControls({
  intent,
  setFilters,
}: {
  intent: DatasetSearchIntent;
  setFilters: Dispatch<SetStateAction<DatasetSearchFilters>>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<'area' | 'period' | null>(null);
  const [area, setArea] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const startYear = Number(start);
  const endYear = Number(end || start);
  const validPeriod =
    !!start &&
    Number.isInteger(startYear) &&
    Number.isInteger(endYear) &&
    startYear >= 1800 &&
    endYear <= 2199 &&
    startYear <= endYear;
  const periodLabel = intent.period
    ? intent.period.start === intent.period.end
      ? String(intent.period.start)
      : `${intent.period.start}–${intent.period.end}`
    : null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {(['area', 'period'] as const).map(key => {
        const value = key === 'area' ? intent.area : periodLabel;
        const label = t(
          key === 'area' ? 'plateJs.dataView.searchArea' : 'plateJs.dataView.searchPeriod'
        );
        return (
          <div key={key} className="flex items-center rounded-sm border">
            <Popover
              open={editing === key}
              onOpenChange={open => {
                setEditing(open ? key : null);
                if (open) {
                  setArea(intent.area ?? '');
                  setStart(intent.period ? String(intent.period.start) : '');
                  setEnd(intent.period ? String(intent.period.end) : '');
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-none px-2 text-xs"
                  data-action-id={`charts.data-view.search.edit-${key}`}
                >
                  {!value && <PlusIcon className="size-3" />}
                  {value
                    ? `${label}: ${value}`
                    : t(
                        key === 'area'
                          ? 'plateJs.dataView.addSearchArea'
                          : 'plateJs.dataView.addSearchPeriod'
                      )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72">
                <form
                  data-action-kind="interaction"
                  className="space-y-3"
                  onSubmit={event => {
                    event.preventDefault();
                    if (key === 'area' ? !area.trim() : !validPeriod) return;
                    setFilters(current => ({
                      ...current,
                      [key]: key === 'area' ? area.trim() : { start: startYear, end: endYear },
                    }));
                    setEditing(null);
                  }}
                >
                  {key === 'area' ? (
                    <label className="block space-y-1 text-sm">
                      {label}
                      <Input
                        autoFocus
                        aria-label={label}
                        value={area}
                        maxLength={120}
                        onChange={event => setArea(event.target.value)}
                        placeholder={t('plateJs.dataView.searchAreaExample')}
                      />
                    </label>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1 text-sm">
                        {t('plateJs.dataView.searchYearFrom')}
                        <Input
                          autoFocus
                          aria-label={t('plateJs.dataView.searchYearFrom')}
                          type="number"
                          min={1800}
                          max={2199}
                          value={start}
                          onChange={event => setStart(event.target.value)}
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        {t('plateJs.dataView.searchYearTo')}
                        <Input
                          aria-label={t('plateJs.dataView.searchYearTo')}
                          type="number"
                          min={1800}
                          max={2199}
                          value={end}
                          onChange={event => setEnd(event.target.value)}
                          placeholder={start}
                        />
                      </label>
                    </div>
                  )}
                  <Button
                    data-action-kind="interaction"
                    type="submit"
                    size="sm"
                    disabled={key === 'area' ? !area.trim() : !validPeriod}
                    data-action-id="charts.data-view.search.apply-filter"
                  >
                    {t('plateJs.dataView.applySearchFilter')}
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-none px-1.5"
                aria-label={t(
                  key === 'area'
                    ? 'plateJs.dataView.removeSearchArea'
                    : 'plateJs.dataView.removeSearchPeriod'
                )}
                data-action-id={`charts.data-view.search.remove-${key}`}
                onClick={() => setFilters(current => ({ ...current, [key]: null }))}
              >
                <XIcon className="size-3" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { featureThemeClassName } from '@/features/shared/theme';
import type React from 'react';
import { BadgeControl } from '@/features/shared/ui/status';
import { FileUploadTrigger, FormControlLabel } from '@/features/shared/ui/form';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/features/shared/ui/ui/accordion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { UserSearchInput } from './UserSearchInput';

interface GroupInvitePeopleInputProps {
  hint: string;
  searchLabel: string;
  searchPlaceholder: string;
  excludeUserId?: string;
  invitedUserIds: string[];
  onInvitedUserIdsChange: (value: string[]) => void;
  csvGuideTitle: string;
  csvGuideDescription: string;
  csvGuideTrigger: string;
  csvGuideFootnote: string;
  csvGuideColumns: ColumnDef<any>[];
  csvGuideRows: any[];
  csvUploadLabel: string;
  csvLabel: string;
  onCsvUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  csvInviteSummary: any | null;
  csvLabels: Record<string, string>;
  invitedCountLabel: string;
}

export function GroupInvitePeopleInput({
  hint,
  searchLabel,
  searchPlaceholder,
  excludeUserId,
  invitedUserIds,
  onInvitedUserIdsChange,
  csvGuideTitle,
  csvGuideDescription,
  csvGuideTrigger,
  csvGuideFootnote,
  csvGuideColumns,
  csvGuideRows,
  csvUploadLabel,
  csvLabel,
  onCsvUpload,
  csvInviteSummary,
  csvLabels,
  invitedCountLabel,
}: GroupInvitePeopleInputProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">{hint}</p>
      <UserSearchInput
        value={invitedUserIds}
        onChange={onInvitedUserIdsChange}
        label={searchLabel}
        placeholder={searchPlaceholder}
        excludeUserId={excludeUserId}
        multi
      />
      <Card surface="mutedSubtle" borderStyle="dashed" elevation="none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet
              className={featureThemeClassName('createUseCreateGroupFormSuccessIcon')}
            />
            {csvGuideTitle}
          </CardTitle>
          <CardDescription>{csvGuideDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Accordion type="single" collapsible>
            <AccordionItem value="csv-format" className="border-none">
              <AccordionTrigger
                data-action-id="create.group-invite.csv-guide.toggle"
                className="hover:bg-muted/50 rounded-md px-3 py-2 text-sm hover:no-underline"
              >
                {csvGuideTrigger}
              </AccordionTrigger>
              <AccordionContent className="space-y-3 px-1 pt-2">
                <DataTable
                  columns={csvGuideColumns}
                  data={csvGuideRows}
                  getRowId={row => `${row.firstName}-${row.lastName}`}
                  enablePagination={false}
                  className="space-y-0"
                />
                <p className="text-muted-foreground text-xs">{csvGuideFootnote}</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2">
        <FileUploadTrigger
          data-action-id="create.group-invite.csv.upload"
          inputProps={{ id: 'csv-upload', accept: '.csv', onChange: onCsvUpload }}
          variant="outline"
          className="h-auto cursor-pointer px-3 py-2 text-sm"
        >
          <Upload className="h-4 w-4" />
          {csvUploadLabel} {csvLabel}
        </FileUploadTrigger>
      </div>
      {csvInviteSummary ? (
        <Card surface="background" borderStyle="muted" elevation="none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{csvLabels.summaryTitle}</CardTitle>
            <CardDescription>{csvLabels.summaryDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <BadgeControl tone="successPale">{csvLabels.foundCount}</BadgeControl>
              <BadgeControl tone="dangerPale">{csvLabels.notFoundCount}</BadgeControl>
              {csvInviteSummary.ambiguousNames.length > 0 ? (
                <BadgeControl tone="warningPale">{csvLabels.ambiguousCount}</BadgeControl>
              ) : null}
            </div>
            <CsvNameBadges
              title={csvLabels.foundNames}
              names={csvInviteSummary.matchedNames}
              titleClassName={featureThemeClassName('createUseCreateGroupFormSuccessText')}
              badgeClassName={featureThemeClassName('createUseCreateGroupFormSuccessBadge')}
            />
            <CsvNameBadges
              title={csvLabels.notFoundNames}
              names={csvInviteSummary.notFoundNames}
              titleClassName={featureThemeClassName('createUseCreateGroupFormDangerText')}
              badgeClassName={featureThemeClassName('createUseCreateGroupFormDangerBadge')}
            />
            {csvInviteSummary.ambiguousNames.length > 0 ? (
              <div className="space-y-2">
                <FormControlLabel
                  className={featureThemeClassName('createUseCreateGroupFormWarningText')}
                >
                  {csvLabels.ambiguousNames}
                </FormControlLabel>
                <div className="space-y-2">
                  {csvInviteSummary.ambiguousNames.map((entry: any) => (
                    <div
                      key={entry.fullName}
                      className={featureThemeClassName('createUseCreateGroupFormWarningSurface')}
                    >
                      <div
                        className={featureThemeClassName(
                          'createUseCreateGroupFormWarningTextAlpha'
                        )}
                      >
                        {entry.fullName}
                      </div>
                      <div
                        className={featureThemeClassName('createUseCreateGroupFormWarningTextBeta')}
                      >
                        {entry.candidatesLabel}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <CsvNameBadges
              title={csvLabels.invalidRows}
              names={csvInviteSummary.invalidRows}
              titleClassName={featureThemeClassName('createUseCreateGroupFormWarningText')}
              badgeClassName={featureThemeClassName('createUseCreateGroupFormWarningBadge')}
            />
          </CardContent>
        </Card>
      ) : null}
      {invitedUserIds.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          {invitedUserIds.length} {invitedCountLabel}
        </p>
      ) : null}
    </div>
  );
}

function CsvNameBadges({
  title,
  names,
  titleClassName,
  badgeClassName,
}: {
  title: string;
  names: string[];
  titleClassName: string;
  badgeClassName: string;
}) {
  if (names.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <FormControlLabel className={titleClassName}>{title}</FormControlLabel>
      <div className="flex flex-wrap gap-2">
        {names.map(name => (
          <BadgeControl key={name} className={badgeClassName}>
            {name}
          </BadgeControl>
        ))}
      </div>
    </div>
  );
}

import { GeoAddressFields } from '@/features/shared/ui/form/GeoAddressFields';
import { GeoAddressMap } from '@/features/shared/ui/form/GeoAddressMap';
export interface GeoAddressPickerViewProps {
  idPrefix: any;
  values: any;
  onFieldChange: any;
  labels: any;
  placeholders: any;
  coordinates: any;
  onCoordinatesChange: any;
  t: any;
  language: any;
  resetContextKey: any;
  setResetContextKey: any;
  isReverseGeocoding: any;
  setIsReverseGeocoding: any;
  reverseRequestIdRef: any;
  isApplyingReverseSyncRef: any;
  ignoreForwardResolutionRef: any;
  handleResolvedAddress: any;
  handleFieldChange: any;
  handleMapCoordinatesChange: any;
}

export function GeoAddressPickerView({
  idPrefix,
  values,
  labels,
  placeholders,
  coordinates,
  t,
  resetContextKey,
  isReverseGeocoding,
  handleResolvedAddress,
  handleFieldChange,
  handleMapCoordinatesChange,
}: GeoAddressPickerViewProps) {
  return (
    <div className="space-y-4">
      <GeoAddressFields
        idPrefix={idPrefix}
        values={values}
        onFieldChange={handleFieldChange}
        labels={labels}
        placeholders={placeholders}
        onResolvedAddress={handleResolvedAddress}
        resetContextKey={resetContextKey}
      />
      <div className="space-y-2">
        <div className="space-y-1">
          <h3 className="text-foreground text-sm font-medium">
            {t('common.locationPicker.title')}
          </h3>
          <p className="text-muted-foreground text-xs">{t('common.locationPicker.description')}</p>
        </div>
        <GeoAddressMap
          coordinates={coordinates}
          onCoordinatesChange={handleMapCoordinatesChange}
          isBusy={isReverseGeocoding}
          loadingLabel={t('common.locationPicker.loading')}
          busyLabel={t('common.locationPicker.syncing')}
          emptyMessage={t('common.locationPicker.empty')}
          moveHint={t('common.locationPicker.moveHint')}
        />
      </div>
    </div>
  );
}

import {
  GeoAddressInputField,
  type GeoAddressField,
} from '@/features/shared/ui/form/GeoAddressInputField';

export type GeoAddressTextMap = Record<GeoAddressField, string>;
const AUTO_COMPLETE_TOKENS: Record<GeoAddressField, string> = {
  country: 'country-name',
  region: 'address-level1',
  city: 'address-level2',
  post_code: 'postal-code',
  street: 'street-address',
  house_number: 'address-line2',
};
export interface GeoAddressFieldsViewProps {
  idPrefix: any;
  values: any;
  onFieldChange: any;
  labels: any;
  placeholders: any;
  onResolvedAddress: any;
  resetContextKey: any;
  context: any;
  setContext: any;
  resolvedAddresses: any;
  setResolvedAddresses: any;
  handleResolved: any;
  handleFieldChange: any;
}

export function GeoAddressFieldsView({
  idPrefix,
  values,
  labels,
  placeholders,
  context,
  handleResolved,
  handleFieldChange,
}: GeoAddressFieldsViewProps) {
  return (
    <>
      <GeoAddressInputField
        id={`${idPrefix}-country`}
        field="country"
        label={labels.country}
        placeholder={placeholders.country}
        value={values.country}
        values={values}
        context={context}
        onChange={value => handleFieldChange('country', value)}
        onResolved={handleResolved}
        autoComplete={AUTO_COMPLETE_TOKENS.country}
      />
      <GeoAddressInputField
        id={`${idPrefix}-region`}
        field="region"
        label={labels.region}
        placeholder={placeholders.region}
        value={values.region}
        values={values}
        context={context}
        onChange={value => handleFieldChange('region', value)}
        onResolved={handleResolved}
        autoComplete={AUTO_COMPLETE_TOKENS.region}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <GeoAddressInputField
          id={`${idPrefix}-city`}
          field="city"
          label={labels.city}
          placeholder={placeholders.city}
          value={values.city}
          values={values}
          context={context}
          onChange={value => handleFieldChange('city', value)}
          onResolved={handleResolved}
          autoComplete={AUTO_COMPLETE_TOKENS.city}
        />
        <GeoAddressInputField
          id={`${idPrefix}-post-code`}
          field="post_code"
          label={labels.post_code}
          placeholder={placeholders.post_code}
          value={values.post_code}
          values={values}
          context={context}
          onChange={value => handleFieldChange('post_code', value)}
          onResolved={handleResolved}
          autoComplete={AUTO_COMPLETE_TOKENS.post_code}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <GeoAddressInputField
          id={`${idPrefix}-street`}
          field="street"
          label={labels.street}
          placeholder={placeholders.street}
          value={values.street}
          values={values}
          context={context}
          onChange={value => handleFieldChange('street', value)}
          onResolved={handleResolved}
          autoComplete={AUTO_COMPLETE_TOKENS.street}
        />
        <GeoAddressInputField
          id={`${idPrefix}-house-number`}
          field="house_number"
          label={labels.house_number}
          placeholder={placeholders.house_number}
          value={values.house_number}
          values={values}
          context={context}
          onChange={value => handleFieldChange('house_number', value)}
          onResolved={handleResolved}
          autoComplete={AUTO_COMPLETE_TOKENS.house_number}
        />
      </div>
    </>
  );
}

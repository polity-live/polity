/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  definition: {
    labelKey: 'object.label',
    propertySchema: [
      { key: 'enabled', labelKey: 'enabled', fieldType: 'boolean' },
      { key: 'choice', labelKey: 'choice', fieldType: 'select' },
      { key: 'combo', labelKey: 'combo', fieldType: 'combobox', unit: 'm' },
      { key: 'count', labelKey: 'count', fieldType: 'number' },
      { key: 'note', labelKey: 'note', fieldType: 'text' },
    ],
  } as any,
}));

vi.mock('../../logic/cityDesignObjectRegistry', async importOriginal => ({
  ...(await importOriginal<typeof import('../../logic/cityDesignObjectRegistry')>()),
  getCityDesignObjectDefinition: () => mocks.definition,
}));
vi.mock('../../logic/cityDesignVariantCatalog', async importOriginal => ({
  ...(await importOriginal<typeof import('../../logic/cityDesignVariantCatalog')>()),
  getCityDesignObjectVariantLabelKey: () => null,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

import { CityDesignObjectPopover } from '../StreetSceneCanvasViewView';

afterEach(cleanup);

describe('CityDesignObjectPopover A04 branch accountability', () => {
  it('handles missing options, numeric and text fields, hidden state, and empty prices', () => {
    const onPropertyChange = vi.fn();
    const onUnitCostChange = vi.fn();
    const onUndoOsmImport = vi.fn();
    const object = {
      id: 'object/one',
      type: 'tree',
      geometry: { kind: 'point', point: { x: 0, z: 0 }, rotationDeg: 0 },
      properties: {
        enabled: false,
        choice: undefined,
        combo: undefined,
        count: undefined,
        note: undefined,
      },
      visible: false,
      cost: { currency: 'EUR', suggestedUnitCostMinor: 100, customUnitCostMinor: null },
      provenance: { source: 'osm', featureId: null },
    } as any;
    const { container } = render(
      <CityDesignObjectPopover
        object={object}
        costLine={null}
        isHidden
        readOnly={false}
        onClose={vi.fn()}
        onVisibilityChange={vi.fn()}
        onPropertyChange={onPropertyChange}
        onWidthChange={vi.fn()}
        onRotationChange={vi.fn()}
        onUnitCostChange={onUnitCostChange}
        onDeleteObject={vi.fn()}
        onUndoOsmImport={onUndoOsmImport}
      />
    );

    const propertyInputs = [...container.querySelectorAll<HTMLInputElement>('input')];
    const numberInput = propertyInputs.find(input => input.getAttribute('aria-label') === 'count');
    const textInput = propertyInputs.find(input => input.getAttribute('aria-label') === 'note');
    const priceInput = propertyInputs.find(input =>
      input.getAttribute('aria-label')?.includes('price')
    );
    fireEvent.change(numberInput!, { target: { value: '7' } });
    fireEvent.change(textInput!, { target: { value: 'note' } });
    fireEvent.change(priceInput!, { target: { value: '' } });
    fireEvent.change(priceInput!, { target: { value: '-5' } });
    fireEvent.click(
      container.querySelector('[data-action-id="amendments.city-object-popover.undo.osm-import"]')!
    );
    expect(onPropertyChange).toHaveBeenCalledWith('object/one', 'count', 7);
    expect(onPropertyChange).toHaveBeenCalledWith('object/one', 'note', 'note');
    expect(onUnitCostChange).toHaveBeenCalledWith('object/one', null);
    expect(onUnitCostChange).toHaveBeenCalledWith('object/one', 0);
    expect(onUndoOsmImport).toHaveBeenCalledWith('');
    expect(
      container.querySelector('[data-action-id="amendments.city-object-popover.toggle.visibility"]')
        ?.textContent
    ).toContain('show');
  });
});

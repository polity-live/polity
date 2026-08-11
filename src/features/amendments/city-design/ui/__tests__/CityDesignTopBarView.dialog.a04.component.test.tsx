/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY } from '../../logic/cityDesignOsm';

vi.mock('@/features/shared/ui/ui-platejs/fixed-toolbar', async () => {
  const { Toolbar } = await vi.importActual<typeof import('@/features/shared/ui/layout')>(
    '@/features/shared/ui/layout'
  );
  return { FixedToolbar: (props: ComponentProps<typeof Toolbar>) => <Toolbar {...props} /> };
});

vi.mock('@/features/shared/ui/ui/dialog', () => {
  const Container = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Dialog: ({
      children,
      onOpenChange,
    }: {
      children?: ReactNode;
      onOpenChange: (open: boolean) => void;
    }) => (
      <div>
        <button type="button" onClick={() => onOpenChange(true)}>
          Mock dialog open
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          Mock dialog close
        </button>
        {children}
      </div>
    ),
    DialogTrigger: Container,
    DialogTitle: Container,
    DialogContent: ({
      children,
      onInteractOutside,
      onEscapeKeyDown,
    }: {
      children?: ReactNode;
      onInteractOutside?: (event: { target: EventTarget; preventDefault: () => void }) => void;
      onEscapeKeyDown?: (event: { preventDefault: () => void }) => void;
    }) => (
      <div>
        <button
          type="button"
          onClick={() => onInteractOutside?.({ target: document.body, preventDefault: vi.fn() })}
        >
          Mock outside
        </button>
        <button type="button" onClick={() => onEscapeKeyDown?.({ preventDefault: vi.fn() })}>
          Mock escape
        </button>
        {children}
      </div>
    ),
  };
});

vi.mock('@/features/editor/ui/InviteCollaboratorDialog', () => ({
  InviteCollaboratorDialog: () => null,
}));

import { CityDesignTopBarView } from '../CityDesignTopBarView';

describe('CityDesignTopBarView dialog alternatives', () => {
  it('guards map-context opening and allows ordinary dialog events', () => {
    const onAreaPickerOpenChange = vi.fn();
    render(
      <CityDesignTopBarView
        readOnly={false}
        mapContextReadOnly
        mode="edit"
        modeDisabledReasons={{}}
        canChangeMode
        isDirty={false}
        isSaving={false}
        saveError={null}
        selectedTool="tree"
        selectedToolProperties={{}}
        interactionMode="select"
        objects={[]}
        selectedObjectId={null}
        selectedOsmWay={null}
        hiddenObjectIds={[]}
        hiddenObjectCategories={[]}
        osmLayerVisibility={DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY}
        showStreetMarkings
        comparisonMode="overlay"
        costSummary={{ currency: 'EUR', totalCostMinor: 0, categories: [], lines: [] }}
        areaPickerOpen={false}
        costSummaryOpen={false}
        isLoadingOsm={false}
        osmError={null}
        areaPickerContent={<div>Picker</div>}
        costSummaryContent={<div>Costs</div>}
        onModeChange={vi.fn()}
        onSave={vi.fn()}
        onToolChange={vi.fn()}
        onInteractionModeChange={vi.fn()}
        onObjectSelect={vi.fn()}
        onObjectVisibilityChange={vi.fn()}
        onObjectCategoryVisibilityChange={vi.fn()}
        onObjectDelete={vi.fn()}
        onObjectCategoryDelete={vi.fn()}
        onOsmLayerVisibilityChange={vi.fn()}
        onShowStreetMarkingsChange={vi.fn()}
        onComparisonModeChange={vi.fn()}
        onAreaPickerOpenChange={onAreaPickerOpenChange}
        onCostSummaryOpenChange={vi.fn()}
        onLoadOsm={vi.fn()}
        onOsmWayHide={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mock dialog open' }));
    expect(onAreaPickerOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mock dialog close' }));
    expect(onAreaPickerOpenChange).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'Mock outside' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock escape' }));
  });
});

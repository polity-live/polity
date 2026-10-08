import { render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '@/styles.css';
import {
  CityDesignWorkspaceFixture,
  createCityDesignWorkspaceProps,
} from './CityDesignWorkspace.fixture';
import { StreetSceneCanvasViewView } from '../StreetSceneCanvasViewView';
import { useState } from 'react';
import { Toolbar } from '@/features/shared/ui/layout';
import { CityDesignSecondaryActionBarView } from '../CityDesignTopBarView';
vi.mock('../StreetAreaPicker', () => ({ StreetAreaPicker: () => null }));
vi.mock('@/features/editor/hooks/useInviteCollaboratorModel', () => ({
  useInviteCollaboratorModel: () => {
    const [open, setOpen] = useState(false);
    return {
      open,
      setOpen,
      filteredUsers: [],
      users: [],
      selectedUsers: [],
      searchQuery: '',
      isLoading: false,
      isInviting: false,
      handleInvite: vi.fn(),
      setSearchQuery: vi.fn(),
      toggleUserSelection: vi.fn(),
    };
  },
}));

it.each([
  { width: 1280, height: 800, navigationView: 'asButtonList' as const, mobile: false },
  { width: 1280, height: 800, navigationView: 'asLabeledButtonList' as const, mobile: false },
  { width: 390, height: 844, navigationView: 'asButtonList' as const, mobile: true },
])(
  'fills the shell without page scrolling at $width px with $navigationView (mobile=$mobile)',
  async options => {
    await page.viewport(options.width, options.height);
    const { container } = render(<CityDesignWorkspaceFixture {...options} />);
    const frame = screen.getByTestId('editor-frame');
    const canvas = container.querySelector('canvas')!;
    await waitFor(() => {
      const rect = canvas.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      expect(rect.width).toBeCloseTo(frameRect.width, 0);
      expect(rect.height).toBeGreaterThan(500);
      expect(rect.bottom).toBeCloseTo(frameRect.bottom, 0);
      expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(options.height);
    });
    expect(container.querySelector('[data-slot="card-header"]')).toBeNull();
    const before = canvas.getBoundingClientRect();
    await userEvent.click(screen.getByRole('button', { name: 'Toggle chat' }));
    expect(screen.getByRole('dialog', { name: 'Project chat' })).toBeTruthy();
    expect(canvas.getBoundingClientRect().width).toBe(before.width);
    await userEvent.click(screen.getByRole('button', { name: 'Toggle chat' }));
  }
);

it('selects an object through the compact cost list and edits its real property fields', async () => {
  await page.viewport(1280, 800);
  const { container } = render(<CityDesignWorkspaceFixture />);
  expect(screen.queryByRole('complementary')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: /^Costs$/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Expand Greenery' }));
  const selectObject = container.ownerDocument.querySelector(
    '[data-action-id="amendments.city-cost.select.cost-object"]'
  )!;
  expect(selectObject.textContent).toMatch(/1 x/);
  await userEvent.click(selectObject);
  await userEvent.keyboard('{Escape}');
  const panel = screen.getByRole('complementary');
  expect(panel.style.left).toBe('16px');
  const heightInput = panel.querySelector<HTMLInputElement>('input[type="number"]');
  expect(heightInput).toBeTruthy();
  await userEvent.fill(heightInput!, '8');
  await userEvent.keyboard('{Tab}');
  expect(heightInput!.value).toBe('8');
  expect(screen.getByRole('status').textContent).toMatch(/unsaved changes/i);
  await userEvent.click(screen.getByRole('button', { name: 'Close properties' }));
  expect(screen.queryByRole('complementary')).toBeNull();
});

it('opens project information with keyboard focus and activation', async () => {
  await page.viewport(1280, 800);
  render(<CityDesignWorkspaceFixture />);
  const information = screen.getByRole('button', { name: 'Project information' });
  expect(information.getAttribute('aria-expanded')).toBe('false');
  information.focus();
  expect(document.activeElement).toBe(information);
  await userEvent.keyboard('{Enter}');
  expect(await screen.findByText('Euckenstraße 38, München')).toBeTruthy();
  await userEvent.keyboard('{Escape}');
  expect(information.getAttribute('aria-expanded')).toBe('false');
});

it('opens existing OSM properties and the legend with native controls', async () => {
  await page.viewport(1280, 800);
  const onOsmWaySelect = vi.fn();
  const onOsmWayImport = vi.fn();
  render(
    <StreetSceneCanvasViewView
      {...createCityDesignWorkspaceProps({
        selectedOsmWay: {
          id: 'osm-road',
          label: 'Existing street',
          kind: 'road',
          geometryKind: 'line',
          points: [
            { lat: 52.52, lon: 13.4 },
            { lat: 52.521, lon: 13.401 },
          ],
          source: 'osm',
          mappedObjectType: 'street',
          mappingConfidence: 'exact',
          tags: { name: 'Existing street', highway: 'residential' },
        },
        onOsmWaySelect,
        onOsmWayImport,
      })}
      canvasRef={{ current: null }}
      loadFailed={false}
      initialLegendOpen
    />
  );
  expect(screen.getByRole('complementary')).toBeTruthy();
  expect(screen.getByText('Existing street')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Collapse Legend' })).toBeTruthy();
  await userEvent.click(
    document.querySelector('[data-action-id="amendments.city-osm-popover.import.as-planned"]')!
  );
  expect(onOsmWayImport).toHaveBeenCalledWith('osm-road');
  await userEvent.click(screen.getByRole('button', { name: 'Close properties' }));
  expect(onOsmWaySelect).toHaveBeenCalledWith(null);
});

it('opens the compact invitation and share controls with keyboard focus', async () => {
  await page.viewport(1280, 800);
  render(
    <Toolbar>
      <CityDesignSecondaryActionBarView
        compact
        amendmentId="a"
        title="Street design"
        readOnly={false}
        currentUserId="u"
        collaborationDocumentId="d"
        existingCollaboratorIds={[]}
        changeRequests={[]}
        selectedChangeRequestId={null}
        showChangeRequests
        onShowChangeRequestsChange={vi.fn()}
        onChangeRequestSelect={vi.fn()}
      />
    </Toolbar>
  );
  const invite = screen.getByRole('button', { name: /^Invite$/ });
  expect(invite.getAttribute('aria-expanded')).toBe('false');
  invite.focus();
  expect(document.activeElement).toBe(invite);
  await userEvent.keyboard('{Enter}');
  expect(await screen.findByRole('dialog')).toBeTruthy();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(document.activeElement).toBe(invite));
  const share = screen.getByRole('button', { name: /^Share$/ });
  share.focus();
  await userEvent.keyboard('{Enter}');
  expect(await screen.findByRole('menu')).toBeTruthy();
  await userEvent.keyboard('{Escape}');
});

import { describe, expect, it } from 'vitest';
import {
  getCityDesignBuildingUse,
  getCityDesignBuildingUseColor,
  getCityDesignBuildingUseProperties,
  updateCityDesignBuildingProperties,
} from '../cityDesignBuildingUse';

describe('cityDesignBuildingUse A04 alternatives', () => {
  it('normalizes valid and invalid uses', () => {
    expect(getCityDesignBuildingUse('office')).toBe('office');
    expect(getCityDesignBuildingUse(1)).toBe('mixed');
    expect(getCityDesignBuildingUseColor('retail')).toBe('#b46b55');
    expect(getCityDesignBuildingUseProperties('civic')).toMatchObject({
      use: 'civic',
      semanticUse: 'civic',
    });
  });

  it('synchronizes semantic use and both color keys', () => {
    expect(updateCityDesignBuildingProperties({}, 'semanticUse', 'office')).toMatchObject({
      use: 'office',
      semanticUse: 'office',
    });
    expect(
      updateCityDesignBuildingProperties({ use: 'office' }, 'renderColor', '#fff')
    ).toMatchObject({ color: '#fff', renderColor: '#fff' });
    expect(updateCityDesignBuildingProperties({ use: 'office' }, 'color', null)).toMatchObject({
      color: '#6f7a82',
      renderColor: '#6f7a82',
    });
    expect(updateCityDesignBuildingProperties({}, 'height', 12)).toEqual({ height: 12 });
  });
});
